// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js";

// --- START: YOUR FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBZ9VKH0SVMOYdvYOO_XY_ycjB0C1ty_BU",
    authDomain: "play-2b9e2.firebaseapp.com",
    // IMPORTANT: You must create a Realtime Database in your Firebase project and add its URL here.
    databaseURL: "https://play-2b9e2-default-rtdb.firebaseio.com", 
    projectId: "play-2b9e2",
    storageBucket: "play-2b9e2.appspot.com",
    messagingSenderId: "717502298791",
    appId: "1:717502298791:web:a170ed9239e5df21987982",
    measurementId: "G-97HGFBY9QJ"
};
// --- END: YOUR FIREBASE CONFIGURATION ---

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// DOM Elements
const numberBoard = document.getElementById('number-board');
const gameStatusEl = document.getElementById('game-status');
const ticketPriceEl = document.getElementById('ticket-price');
const gameStartTimeEl = document.getElementById('game-start-time');
const ticketsContainer = document.getElementById('tickets-container');
const boardContainer = document.getElementById('board-container');
const calledNumbersList = document.getElementById('called-numbers-list');
const winnerModal = document.getElementById('winner-modal');
const winnerTitle = document.getElementById('winner-title');
const winnerDetails = document.getElementById('winner-details');
const awardsInfo = document.getElementById('awards-info');
const ticketSearch = document.getElementById('ticket-search');

// State for sound and speech control
let lastAnnouncedWinners = {};
let lastGameState = null;
const synth = window.speechSynthesis;
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// --- Sound and Speech Synthesis ---

function speak(text) {
    if (synth.speaking) {
        console.error('SpeechSynthesis.speaking');
        return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = synth.getVoices().find(v => v.name.includes('Google US English') && v.lang.includes('en-US')) || synth.getVoices()[0];
    utterance.pitch = 1;
    utterance.rate = 0.9;
    synth.speak(utterance);
}

function playWinnerSound() {
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 0.05);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.2);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);

        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.2);
    } catch (e) {
        console.error("Could not play sound:", e);
    }
}


// Create the number board UI
function createBoard() {
    numberBoard.innerHTML = '';
    for (let i = 1; i <= 90; i++) {
        const numberDiv = document.createElement('div');
        numberDiv.classList.add('number');
        numberDiv.id = `num-${i}`;
        numberDiv.textContent = i;
        numberBoard.appendChild(numberDiv);
    }
}

// Render tickets from data
function renderTickets(tickets, calledNumbers) {
    ticketsContainer.innerHTML = '';
    if (!tickets) return;

    Object.values(tickets).forEach(ticket => {
        const ticketEl = document.createElement('div');
        ticketEl.classList.add('ticket');
        ticketEl.dataset.ticketNumber = ticket.ticketNumber;
        ticketEl.dataset.ticketOwner = ticket.owner.toLowerCase();


        let ticketHTML = `
            <div class="ticket-header">
                <div class="ticket-number">Ticket #${ticket.ticketNumber}</div>
                <div class="ticket-owner">${ticket.owner}</div>
            </div>
            <div class="ticket-grid">
        `;
        
        ticket.numbers.forEach(row => {
            row.forEach(num => {
                if (num === null) {
                    ticketHTML += `<div class="ticket-cell"></div>`;
                } else {
                    const isMarked = calledNumbers && calledNumbers[num];
                    ticketHTML += `<div class="ticket-cell filled ${isMarked ? 'marked' : ''}">${num}</div>`;
                }
            });
        });

        ticketHTML += `</div>`;
        
        if (ticket.owner === 'Unbooked') {
            const message = encodeURIComponent(`I'd like to book ticket #${ticket.ticketNumber}`);
            // IMPORTANT: Replace placeholder number with your actual WhatsApp number
            ticketHTML += `<a href="https://wa.me/1234567890?text=${message}" target="_blank" class="book-link">Book Now on WhatsApp</a>`;
        }
        
        ticketEl.innerHTML = ticketHTML;
        ticketsContainer.appendChild(ticketEl);
    });
}

// Update UI based on game state
function updateUI(gameState) {
    // Game Status
    const statusText = gameState.gameState ? gameState.gameState.charAt(0).toUpperCase() + gameState.gameState.slice(1) : 'Waiting...';
    gameStatusEl.textContent = statusText;
    
    // --- Voice Prompts on State Change ---
    if (lastGameState !== gameState.gameState) {
        if (gameState.gameState === 'running' && lastGameState !== 'running') {
            speak("Game started.");
        }
        lastGameState = gameState.gameState;
    }

    // Show/Hide board
    boardContainer.style.display = (gameState.gameState === 'running') ? 'block' : 'none';

    // Ticket Price
    ticketPriceEl.textContent = gameState.ticketPrice ? `₹${gameState.ticketPrice}` : '--';

    // Game Start Time
    gameStartTimeEl.textContent = gameState.gameStartTime ? new Date(gameState.gameStartTime).toLocaleString() : 'Not Scheduled';
    
    // Update called numbers on the main board
    document.querySelectorAll('.number.called').forEach(el => el.classList.remove('called'));
    if (gameState.calledNumbers) {
        Object.keys(gameState.calledNumbers).forEach(num => {
            const numEl = document.getElementById(`num-${num}`);
            if (numEl) numEl.classList.add('called');
        });
    }

    // Update called numbers list
    calledNumbersList.innerHTML = '';
    if(gameState.calledNumbers) {
        const sortedCalledNumbers = Object.keys(gameState.calledNumbers).map(Number).sort((a,b) => a-b);
        sortedCalledNumbers.forEach(num => {
            const item = document.createElement('div');
            item.className = 'called-number-item';
            item.textContent = num;
            calledNumbersList.appendChild(item);
        });
    }
    
    // Render Tickets
    renderTickets(gameState.tickets, gameState.calledNumbers);

    // Render Awards and check for new winners
    awardsInfo.innerHTML = '';
    if (gameState.awards) {
        Object.entries(gameState.awards).forEach(([key, award]) => {
            const awardEl = document.createElement('div');
            let winnerText = 'Pending';
            if (award.winner) {
                winnerText = `🏆 ${award.winner.owner} (Tkt #${award.winner.ticketNumber})`;
                // Check if this is a new winner announcement
                if (!lastAnnouncedWinners[key]) {
                    winnerTitle.innerHTML = `🎉 ${award.name} Won! 🎉`;
                    winnerDetails.textContent = `Won by ${award.winner.owner} with Ticket #${award.winner.ticketNumber}`;
                    winnerModal.style.display = 'flex';
                    playWinnerSound();
                    setTimeout(() => { winnerModal.style.display = 'none'; }, 5000);
                    lastAnnouncedWinners[key] = true;
                }
            }
            awardEl.innerHTML = `<span>${award.name} (₹${award.prize || 0}):</span> ${winnerText}`;
            awardsInfo.appendChild(awardEl);
        });
    }

    // After rendering, apply search filter if there's any text
    filterTickets();
}

// Search/Filter logic
function filterTickets() {
    const query = ticketSearch.value.toLowerCase();
    const allTickets = document.querySelectorAll('.ticket');
    allTickets.forEach(ticket => {
        const number = ticket.dataset.ticketNumber;
        const owner = ticket.dataset.ticketOwner;
        if (number.includes(query) || owner.includes(query)) {
            ticket.style.display = 'block';
        } else {
            ticket.style.display = 'none';
        }
    });
}

// Main function to initialize the page
function main() {
    createBoard();
    
    // Initial voice prompt if game is not running
    setTimeout(() => {
       if(gameStatusEl.textContent === 'Waiting...' || gameStatusEl.textContent === 'Stopped'){
            speak("Game will commence at the time set by admin.");
       }
    }, 2000);

    const gameRef = ref(database, 'tambolaGame/activeGame');
    onValue(gameRef, (snapshot) => {
        const gameState = snapshot.val();
        if (gameState) {
            updateUI(gameState);
        } else {
            console.log("No active game found in the database.");
            gameStatusEl.textContent = 'No Game Active';
        }
    });

    ticketSearch.addEventListener('input', filterTickets);
}

// Run on page load
main();

