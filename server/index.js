const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware ---
app.use(cors());
app.use(express.json());
// Serve uploaded files statically so they can be viewed in the browser
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- File Upload Setup (Multer) ---
// Ensure the 'uploads' directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
    }
});
const upload = multer({ storage: storage });

// --- MongoDB Connection ---
const dbURI = process.env.MONGO_URI;

mongoose.connect(dbURI)
    .then(() => console.log("MongoDB successfully connected"))
    .catch(err => console.error("MongoDB connection error:", err));

// --- Mongoose Schemas ---
const clubSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

// Middleware to hash password before saving
clubSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

const eventSchema = new mongoose.Schema({
    clubName: { type: String, required: true },
    name: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    venue: { type: String, required: true },
    posterPath: { type: String, required: true },
    registerLink: { type: String, required: false },
});

const Club = mongoose.model('Club', clubSchema);
const Event = mongoose.model('Event', eventSchema);

// --- API Routes ---

// POST /api/clubs - Create a new club
app.post('/api/clubs', async (req, res) => {
    try {
        const { name, password } = req.body;
        if (!name || !password) {
            return res.status(400).json({ message: 'Club name and password are required' });
        }
        const newClub = new Club({ name, password });
        await newClub.save();
        res.status(201).json({ message: 'Club added successfully' });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: 'A club with this name already exists.' });
        }
        console.error("Error adding club:", error);
        res.status(500).json({ message: 'Server error while adding the club.' });
    }
});

// GET /api/clubs - Get all club names
app.get('/api/clubs', async (req, res) => {
    try {
        const clubs = await Club.find({}).select('name');
        res.json(clubs);
    } catch (error) {
        console.error("Error fetching clubs:", error);
        res.status(500).json({ message: 'Error fetching clubs.' });
    }
});

// POST /api/auth - Authenticate a club
app.post('/api/auth', async (req, res) => {
    try {
        const { name, password } = req.body;
        const club = await Club.findOne({ name });
        if (!club) {
            return res.status(401).json({ message: 'Invalid club name or password.' });
        }
        const isMatch = await bcrypt.compare(password, club.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid club name or password.' });
        }
        res.status(200).json({ message: 'Authentication successful.' });
    } catch (error) {
        console.error("Authentication error:", error);
        res.status(500).json({ message: 'An authentication error occurred.' });
    }
});

// POST /api/events - Create a new event
app.post('/api/events', upload.single('poster'), async (req, res) => {
    try {
        const { clubName, name, startDate, endDate, venue, registerLink, password } = req.body;
        const posterPath = req.file ? req.file.path : null;

        const club = await Club.findOne({ name: clubName });
        if (!club || !(await bcrypt.compare(password, club.password))) {
            if (posterPath) fs.unlinkSync(posterPath);
            return res.status(401).json({ message: 'Authentication failed. Invalid password.' });
        }

        if (!name || !startDate || !endDate || !venue || !posterPath) {
            if (posterPath) fs.unlinkSync(posterPath);
            return res.status(400).json({ message: 'All required fields must be filled.' });
        }

        const newEvent = new Event({ clubName, name, startDate, endDate, venue, posterPath, registerLink });
        await newEvent.save();
        res.status(201).json({ message: 'Event created successfully!', event: newEvent });

    } catch (error) {
        if (req.file) fs.unlinkSync(req.file.path);
        console.error("Error creating event:", error);
        res.status(500).json({ message: 'Server error while creating the event.' });
    }
});

// GET /api/events - Get all events
app.get('/api/events', async (req, res) => {
    try {
        const events = await Event.find({}).sort({ startDate: 1 });
        res.json(events);
    } catch (error) {
        console.error("Error fetching events:", error);
        res.status(500).json({ message: 'Error fetching events.' });
    }
});

// --- NEW ROUTES FOR EDIT/DELETE ---

// GET /api/events/:id - Get details for a single event (for the edit form)
app.get('/api/events/:id', async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found.' });
        }
        res.json(event);
    } catch (error) {
        console.error("Error fetching single event:", error);
        res.status(500).json({ message: 'Server error.' });
    }
});

// PUT /api/events/:id - Update an event
app.put('/api/events/:id', upload.single('poster'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, startDate, endDate, venue, registerLink, password, clubName } = req.body;

        const club = await Club.findOne({ name: clubName });
        if (!club || !(await bcrypt.compare(password, club.password))) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(401).json({ message: 'Authentication failed.' });
        }

        const eventToUpdate = await Event.findById(id);
        if (!eventToUpdate) {
            return res.status(404).json({ message: 'Event not found.' });
        }

        const updateData = { name, startDate, endDate, venue, registerLink };
        
        if (req.file) {
            if (fs.existsSync(eventToUpdate.posterPath)) {
                fs.unlinkSync(eventToUpdate.posterPath);
            }
            updateData.posterPath = req.file.path;
        }

        const updatedEvent = await Event.findByIdAndUpdate(id, updateData, { new: true });
        res.status(200).json({ message: 'Event updated successfully!', event: updatedEvent });

    } catch (error) {
        if (req.file) fs.unlinkSync(req.file.path);
        console.error("Error updating event:", error);
        res.status(500).json({ message: 'Server error while updating the event.' });
    }
});

// DELETE /api/events/:id - Delete an event
app.delete('/api/events/:id', async (req, res) => {
    try {
        const { password } = req.body;
        const { id } = req.params;

        const event = await Event.findById(id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found.' });
        }

        const club = await Club.findOne({ name: event.clubName });
        if (!club) {
            return res.status(404).json({ message: 'Associated club not found.' });
        }

        const isMatch = await bcrypt.compare(password, club.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Authentication failed. Invalid password.' });
        }

        if (fs.existsSync(event.posterPath)) {
            fs.unlinkSync(event.posterPath);
        }

        await Event.findByIdAndDelete(id);
        res.status(200).json({ message: 'Event deleted successfully.' });

    } catch (error) {
        console.error("Error deleting event:", error);
        res.status(500).json({ message: 'Server error while deleting the event.' });
    }
});

// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
});

