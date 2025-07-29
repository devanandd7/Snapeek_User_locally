const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./src/config/db');
const cron = require('node-cron');
const downloadAllCloudinaryImages = require('./src/utils/downloadAllCloudinaryImages');
const path = require('path');
const fs = require('fs');
const { getSession } = require('./src/lib/session');
const os = require('os');
const Note = require('./src/models/Note'); // Add Note model
const downloadNotes = require('./src/utils/downloadNotes');
const desktopPath = path.join(os.homedir(), 'Desktop', 'SnapeekImages');
// Change: Store notes inside SnapeekImages folder
const getNotesPath = (userEmail) => {
  const safeUser = userEmail.replace(/[@.]/g, '_');
  return path.join(desktopPath, safeUser, 'notes');
};

const app = express();
const PORT = process.env.PORT || 5000;

// app.use(cors({
//   origin: 'http://localhost:3000',
//   credentials: true
// }));
app.use(express.json());
app.use(cookieParser());

// Serve images statically
app.use('/images', express.static(desktopPath));

// Serve everything under SnapeekNotes
const notesDesktopPath = path.join(os.homedir(), 'Desktop', 'SnapeekNotes');
app.use('/notes', express.static(notesDesktopPath));
// Serve note images by local path
app.get('/notes/api/image', (req, res) => {
  let imgPath = req.query.path;
  if (!imgPath) return res.status(400).send('Missing image path');
  imgPath = path.normalize(imgPath).replace(/^([/\\]+)/, ''); // Remove leading slashes
  const baseDir = path.join(process.env.HOME || process.env.USERPROFILE, 'Desktop', 'SnapeekImages');
  const fullPath = path.resolve(baseDir, imgPath);
  if (!fullPath.startsWith(baseDir)) return res.status(403).send('Forbidden');
  // Only allow image extensions
  const ext = path.extname(fullPath).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) return res.status(403).send('Invalid image type');
  fs.access(fullPath, fs.constants.R_OK, err => {
    if (err) {
      // fallback to a placeholder image
      return res.sendFile(path.join(__dirname, 'public', 'file.svg'));
    }
    // Set content type based on extension
    if (ext === '.jpg' || ext === '.jpeg') res.type('jpeg');
    else if (ext === '.png') res.type('png');
    else if (ext === '.gif') res.type('gif');
    res.sendFile(fullPath);
  });
});

// Serve login.html and download.html as static files
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});
app.get('/download.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'download.html'));
});

// Serve download_notes.html as static file (to be created)
app.get('/download_notes.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'download_notes.html'));
});

// Serve notes.html as static file for notes gallery
app.get('/notes.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'notes.html'));
});

// Serve the gallery.html at the root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'gallery.html'));
});

// API endpoint to list local images by folder (supports user folders)
app.get('/images/api/folders', (req, res) => {
  try {
    const imagesRoot = desktopPath;
    if (!fs.existsSync(imagesRoot)) return res.json({});
    let userFolders = fs.readdirSync(imagesRoot).filter(f => fs.statSync(path.join(imagesRoot, f)).isDirectory());
    // If user is logged in, only show their folder
    const session = getSession(req);
    if (session && session.email) {
      const safeUser = session.email.replace(/[@.]/g, '_');
      userFolders = userFolders.filter(f => f === safeUser);
    }
    let result = {};
    userFolders.forEach(userFolder => {
      const userPath = path.join(imagesRoot, userFolder);
      const categoryFolders = fs.readdirSync(userPath).filter(f => fs.statSync(path.join(userPath, f)).isDirectory());
      result[userFolder] = {};
      categoryFolders.forEach(category => {
        const categoryPath = path.join(userPath, category);
        const files = fs.readdirSync(categoryPath);
        const images = files.filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f));
        if (images.length > 0) {
          
          result[userFolder][category] = images.map(f => {
            const base = f.replace(/\.[^/.]+$/, '');
            const txtFile = base + '.txt';
            let description = '';
            if (files.includes(txtFile)) {
              try {
                description = fs.readFileSync(path.join(categoryPath, txtFile), 'utf8');
              } catch {}
            }
            return {
              url: `/images/${userFolder}/${category}/${f}`,
              description
            };
          });
        }
      });
      if (Object.keys(result[userFolder]).length === 0) delete result[userFolder];
    });
    res.json(result);
  } catch (err) {
    console.error('Error in /images/api/folders:', err);
    res.status(500).json({ error: err.message });
  }
});

// API endpoint to download notes and their images/details
app.post('/notes/api/download', async (req, res) => {
  const session = getSession(req);
  if (!session || !session.email) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const result = await downloadNotes(session.email);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Failed to download notes:', err);
    res.status(500).json({ error: err.message });
  }
});

// API endpoint to list downloaded notes for the logged-in user
// Create/upload a new note
app.post('/notes/api/create', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session || !session.email) {
      return res.status(401).json({ error: 'Not logged in' });
    }
    const {
      imageUrl,
      noteContent,
      noteType,
      subject,
      imageId // optional, can be generated or omitted
    } = req.body;
    if (!imageUrl || !noteContent || !noteType || !subject) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const note = new Note({
      userId: session.email,
      imageId: imageId || undefined,
      imageUrl,
      noteContent,
      noteType,
      subject,
      createdAt: new Date(),
      lastModified: new Date()
    });
    await note.save();
    res.json({ success: true, note });
  } catch (err) {
    console.error('Error in /notes/api/create:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/notes/api/list', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session || !session.email) {
      return res.status(401).json({ error: 'Not logged in' });
    }

    const safeUser = session.email.replace(/[@.]/g, '_');
    const userPath = path.join(desktopPath, safeUser);
    
    let result = {};

    // Check if user directory exists
    if (fs.existsSync(userPath)) {
      // Get all subject folders
      const subjects = fs.readdirSync(userPath)
        .filter(f => fs.statSync(path.join(userPath, f)).isDirectory());

      // Process each subject folder
      for (const subject of subjects) {
        const subjectPath = path.join(userPath, subject);
        const files = fs.readdirSync(subjectPath);
        
        // Filter markdown files (notes)
        const notes = files.filter(f => f.endsWith('.md'));
        
        if (notes.length > 0) {
          result[subject] = notes.map(note => {
            const notePath = path.join(subjectPath, note);
            const content = fs.readFileSync(notePath, 'utf8');
            const noteId = path.basename(note, '.md');
            
            // Check for corresponding image
            const possibleImageExts = ['.jpg', '.jpeg', '.png', '.gif'];
            const imageFile = possibleImageExts
              .map(ext => noteId + ext)
              .find(f => files.includes(f));

            // Parse metadata from markdown content
            const lines = content.split('\n');
            const metadata = {};
            let metadataSection = false;
            let noteContent = '';
            let contentStarted = false;

            for (const line of lines) {
              if (line.trim() === '---') {
                if (!metadataSection) {
                  metadataSection = true;
                  continue;
                } else {
                  metadataSection = false;
                  continue;
                }
              }

              if (metadataSection) {
                const [key, value] = line.split(':').map(s => s.trim());
                if (key && value) {
                  metadata[key] = value;
                }
              } else if (!metadataSection && line !== '') {
                contentStarted = true;
                noteContent += line + '\n';
              } else if (contentStarted) {
                noteContent += line + '\n';
              }
            }

            return {
              id: noteId,
              subject,
              content: noteContent.trim(),
              created: metadata.created,
              modified: metadata.modified,
              type: metadata.type,
              imagePath: imageFile ? `/images/${safeUser}/${subject}/${imageFile}` : null
            };
          });
        }
      }
    }

    res.json({ notes: result });
  } catch (err) {
    console.error('Error in /notes/api/list:', err);
    res.status(500).json({ error: err.message });
  }
});

// Connect to MongoDB
connectDB(); // REMOVE this line so server starts without DB

// Middleware
app.use(express.json());

// Routes
app.use('/auth', require('./src/routes/auth'));
app.use('/images', require('./src/routes/images'));
app.use('/notes', require('./src/routes/notes'));



// Schedule: every day at 12am (midnight)
cron.schedule('0 0 * * *', async () => {
  console.log('Scheduled image download started...');
  try {
    const result = await downloadAllCloudinaryImages();
    console.log('Scheduled download summary:', result);
  } catch (err) {
    console.error('Scheduled download failed:', err);
  }
});

app.listen(PORT, () => {


  console.log(`
  ══════════════════════════════ 📸 Snapeek 📸 ══════════════════════════════
  
  ✨ Welcome to Snapeek – Your Personal Image & Screenshot Gallery!
  
  🌐 Local Gallery Access:        http://localhost:${PORT}
  📤 Upload Screenshots/Images:   https://snapeek.vercel.app
  ❗ Keep Terminal Open:          Minimize with [ - ], avoid closing [ X ]
  
  🛠️ If the server stops running:
  👉 Double-click Snapeek.exe again to restart the server.
  👉 Or, if set up, it will auto-start with your computer.
  
  🔍 To View Your Gallery:
  1️⃣  Open your web browser (Chrome, Edge, Firefox, etc.).
  2️⃣  Paste the local URL: http://localhost:${PORT}
  3️⃣  Browse your screenshots and images by folders or categories.
  4️⃣  Use the Download button to sync new images (login required).
  
  💡 Tips:
  - You can bookmark the gallery page for quick access.
  - Images and descriptions are stored on your Desktop in the "SnapeekImages" folder.
  - The app works offline! You only need internet for cloud sync or login.
  
  🔒 Privacy Note:
  Your data stays local by default. You can choose to sync with the cloud for remote access.
  
  📦 Snapeek runs silently in the background. Enjoy uninterrupted access!
  
  ❓ Need help?
  - Visit the Snapeek website or contact support for assistance.
  
  ═══════════════════════════════════════════════════════════════════════════
  `);
  
  
});
