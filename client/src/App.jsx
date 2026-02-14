import React, { useState, useEffect, useCallback } from 'react';

// --- Main API URL ---
const API_URL = 'http://localhost:5000';

// --- Helper Functions ---
const formatDate = (isoDate) => {
    if (!isoDate) return 'N/A';
    const date = new Date(isoDate);
    return isNaN(date) ? 'Invalid Date' : date.toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
};

// --- Child Components ---

const Navbar = ({ setPage }) => (
    <nav className="flex justify-between items-center p-4 mb-10 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl">
        <div className="text-xl font-bold text-white">EventHub</div>
        <div className="space-x-6">
            <button onClick={() => setPage('home')} className="text-gray-400 hover:text-blue-500 font-semibold transition-colors">View Events</button>
            <button onClick={() => setPage('login')} className="text-gray-400 hover:text-blue-500 font-semibold transition-colors">Club Login</button>
        </div>
    </nav>
);

const EventCard = ({ event, onCardClick }) => (
    <div 
        className="bg-gray-900/50 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-500/20"
        onClick={() => onCardClick(event._id)}
    >
        <img src={`${API_URL}/${event.posterPath.replace(/\\/g, '/')}`} alt={`${event.name} Poster`} className="w-full h-56 object-cover border-b-2 border-blue-500" />
        <div className="p-6">
            <h2 className="text-2xl font-bold text-white mb-3">{event.name}</h2>
            <p className="flex items-center gap-3 text-gray-400 mb-2"><i className="fas fa-users text-blue-500"></i> {event.clubName}</p>
            <p className="flex items-center gap-3 text-gray-400 mb-2"><i className="fas fa-calendar-alt text-blue-500"></i> {formatDate(event.startDate)}</p>
            <p className="flex items-center gap-3 text-gray-400"><i className="fas fa-map-marker-alt text-blue-500"></i> {event.venue}</p>
        </div>
    </div>
);

const EventModal = ({ eventId, onClose }) => {
    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!eventId) return;
        setLoading(true);
        setError('');
        fetch(`${API_URL}/api/events/${eventId}`)
            .then(res => res.json())
            .then(data => {
                setEvent(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch event details:", err);
                setError('Could not load event details. Please check the server connection.');
                setLoading(false);
            });
    }, [eventId]);

    if (!eventId) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-900/70 backdrop-blur-xl border border-white/20 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                {loading && <p className="text-white text-center p-10">Loading...</p>}
                {error && <p className="text-red-500 text-center p-10">{error}</p>}
                {!loading && !error && event && (
                    <>
                        <img src={`${API_URL}/${event.posterPath.replace(/\\/g, '/')}`} alt={event.name} className="w-full h-80 object-cover" />
                        <div className="p-8">
                            <h1 className="text-4xl font-bold text-white mb-4">{event.name}</h1>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-lg mb-8">
                                <div className="flex items-center gap-4 text-gray-300"><i className="fas fa-users text-blue-400 text-2xl"></i><div><strong>Organized by:</strong><br/>{event.clubName}</div></div>
                                <div className="flex items-center gap-4 text-gray-300"><i className="fas fa-map-marker-alt text-blue-400 text-2xl"></i><div><strong>Venue:</strong><br/>{event.venue}</div></div>
                                <div className="flex items-center gap-4 text-gray-300"><i className="fas fa-calendar-alt text-blue-400 text-2xl"></i><div><strong>Starts:</strong><br/>{formatDate(event.startDate)}</div></div>
                                <div className="flex items-center gap-4 text-gray-300"><i className="fas fa-calendar-check text-blue-400 text-2xl"></i><div><strong>Ends:</strong><br/>{formatDate(event.endDate)}</div></div>
                            </div>
                            {event.registerLink && <a href={event.registerLink} target="_blank" rel="noopener noreferrer" className="inline-block bg-blue-600 text-white font-bold py-3 px-8 rounded-lg text-lg hover:bg-blue-700 transition-colors">Register Now</a>}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// --- Page Components ---

const ViewEventsPage = () => {
    const [events, setEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(`${API_URL}/api/events?t=${new Date().getTime()}`)
            .then(res => res.json())
            .then(data => setEvents(data))
            .catch(err => {
                console.error("Failed to fetch events:", err);
                if (err instanceof TypeError && err.message === 'Failed to fetch') {
                    setError('Could not connect to the server. Please make sure your backend server (node index.js) is running.');
                } else {
                    setError('An error occurred while fetching events.');
                }
            });
    }, []);

    return (
        <>
            <div className="text-center mb-12">
                <h1 className="text-5xl font-bold text-white mb-3">Upcoming Campus Events</h1>
                <p className="text-xl text-gray-400">Your central hub for all student activities.</p>
            </div>
            {error ? <p className="text-red-500 text-center text-xl">{error}</p> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {events.map(event => (
                        <EventCard key={event._id} event={event} onCardClick={setSelectedEventId} />
                    ))}
                </div>
            )}
            <EventModal eventId={selectedEventId} onClose={() => setSelectedEventId(null)} />
        </>
    );
};

const ClubLoginPage = ({ onLogin }) => {
    const [clubs, setClubs] = useState([]);
    const [selectedClub, setSelectedClub] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(`${API_URL}/api/clubs`).then(res => res.json()).then(data => setClubs(data))
        .catch(err => {
            console.error("Failed to fetch clubs:", err);
            setError('Could not load clubs. Is the server running?');
        });
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const response = await fetch(`${API_URL}/api/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: selectedClub, password })
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message);
            }
            onLogin(selectedClub);
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="flex justify-center items-center">
             <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-xl w-full max-w-md">
                <h2 className="text-3xl font-bold text-center text-white mb-6">Club Admin Login</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-gray-400 mb-2">Club Name</label>
                        <select value={selectedClub} onChange={e => setSelectedClub(e.target.value)} className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white">
                            <option value="">Select a club</option>
                            {clubs.map(club => <option key={club._id} value={club.name}>{club.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-gray-400 mb-2">Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white" />
                    </div>
                    <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors">Login</button>
                    {error && <p className="text-red-500 text-center mt-4">{error}</p>}
                </form>
            </div>
        </div>
    );
};


// --- Main App Component ---

export default function App() {
    const [page, setPage] = useState('home'); // 'home', 'login'
    const [loggedInClub, setLoggedInClub] = useState(null); // This would be more robust with tokens in a real app

    // In a real app, you'd check session/local storage for a token here
    // For simplicity, we'll just use state

    const handleLogin = (clubName) => {
        setLoggedInClub(clubName);
        // In a real app, you'd navigate to a dashboard page. Here we'll just re-render.
        // This is a simplification. A router like React Router is needed for a true SPA experience.
        alert(`Successfully logged in as ${clubName}! In a full React app, you would be redirected to your dashboard.`);
        setPage('home'); // Go back home after login for this example
    };

    const renderPage = () => {
        switch (page) {
            case 'login':
                return <ClubLoginPage onLogin={handleLogin} />;
            case 'home':
            default:
                return <ViewEventsPage />;
        }
    };

    return (
        <div className="bg-gray-900 min-h-screen text-white font-sans" style={{backgroundImage: "radial-gradient(ellipse at top, hsl(231, 15%, 18%) 0%, #121212 60%)"}}>
            <div className="container mx-auto p-8">
                <Navbar setPage={setPage} />
                <main>
                    {renderPage()}
                </main>
            </div>
        </div>
    );
}

