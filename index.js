// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js";

// --- START: YOUR FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBZ9VKH0SVMOYdvYOO_XY_ycjB0C1ty_BU",
    authDomain: "play-2b9e2.firebaseapp.com",
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

// --- Sound and Speech Synthesis ---
const synth = window.speechSynthesis;
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let voices = [];
let isSpeechReady = false;

function loadVoices() {
    voices = synth.getVoices();
    if (voices.length > 0) {
        console.log("Voices loaded successfully.");
        isSpeechReady = true;
    } else {
        console.log("Waiting for voices to load...");
    }
}
loadVoices();
if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = loadVoices;
}

function speak(text) {
    if (!isSpeechReady || !text) {
        console.warn("Speech synthesis not ready or text is empty.", { isSpeechReady, text });
        return;
    }
    if (audioContext.state === 'suspended') audioContext.resume();
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    let selectedVoice = voices.find(v => v.lang === 'en-US' && v.name.includes('Google'));
    if (!selectedVoice) selectedVoice = voices.find(v => v.lang.startsWith('en-') && v.name.includes('Google'));
    if (!selectedVoice) selectedVoice = voices.find(v => v.lang.startsWith('en-'));
    
    utterance.voice = selectedVoice;
    utterance.pitch = 1;
    utterance.rate = 0.9;
    utterance.onerror = (event) => console.error('SpeechSynthesisUtterance.onerror', event);

    setTimeout(() => {
        synth.speak(utterance);
    }, 100);
}

function playWinnerSound() {
    try {
        if (audioContext.state === 'suspended') audioContext.resume();
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

function numberToWords(num) {
    const single = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
    if (num < 10) return single[num];
    if (num === 90) return "nine zero, ninety";
    const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
    const teens = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
    if (num < 20) return teens[num - 10];
    const tenDigit = Math.floor(num / 10);
    const oneDigit = num % 10;
    return `${single[tenDigit]} ${single[oneDigit]}, ${tens[tenDigit]}${oneDigit > 0 ? ' ' + single[oneDigit] : ''}`;
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

// --- START: CORRECTED TICKET RENDERING LOGIC ---
// Render tickets from data, ensuring a 3x9 grid is always created.
function renderTickets(tickets, calledNumbers) {
    ticketsContainer.innerHTML = '';
    if (!tickets) return;
    Object.values(tickets).forEach(ticket => {
        const ticketEl = document.createElement('div');
        ticketEl.classList.add('ticket');
        ticketEl.dataset.ticketNumber = ticket.ticketNumber;
        ticketEl.dataset.ticketOwner = ticket.owner.toLowerCase();
        
        const ticketGridDiv = document.createElement('div');
        ticketGridDiv.className = 'ticket-grid';
        
        const table = document.createElement('table');
        table.className = 'ticket-table';

        const ticketData = ticket.numbers || [];

        for (let r = 0; r < 3; r++) {
            const tr = document.createElement('tr');
            // When Firebase sends a sparse array, it becomes an object.
            // Or it could be a normal array if it's not sparse (which won't happen here).
            // This handles both cases.
            const rowData = ticketData[r] || {}; 
            for (let c = 0; c < 9; c++) {
                const td = document.createElement('td');
                td.className = 'ticket-cell';
                // Access data using the column index `c`. This works for both arrays and objects.
                const number = rowData[c]; 

                if (number) {
                    td.classList.add('filled');
                    td.textContent = number;
                    if (calledNumbers && calledNumbers[number]) {
                        td.classList.add('marked');
                    }
                }
                tr.appendChild(td);
            }
            table.appendChild(tr);
        }
        ticketGridDiv.appendChild(table);

        let ticketHeaderHTML = `
            <div class="ticket-header">
                <div class="ticket-number">Ticket #${ticket.ticketNumber}</div>
                <div class="ticket-owner">${ticket.owner}</div>
            </div>`;
        
        ticketEl.innerHTML = ticketHeaderHTML;
        ticketEl.appendChild(ticketGridDiv);

        if (ticket.owner === 'Unbooked') {
            const link = document.createElement('a');
            link.href = `https://wa.me/910000000000?text=${encodeURIComponent(`I'd like to book ticket #${ticket.ticketNumber}`)}`;
            link.target = "_blank";
            link.className = "book-link";
            link.textContent = "Book Now on WhatsApp";
            ticketEl.appendChild(link);
        }

        ticketsContainer.appendChild(ticketEl);
    });
}
// --- END: CORRECTED TICKET RENDERING LOGIC ---


// Efficiently filter tickets without re-rendering everything
function filterTickets() {
    const query = ticketSearch.value.toLowerCase();
    document.querySelectorAll('.ticket').forEach(ticket => {
        const number = ticket.dataset.ticketNumber || '';
        const owner = ticket.dataset.ticketOwner || '';
        ticket.style.display = (number.includes(query) || owner.includes(query)) ? 'block' : 'none';
    });
}

// State variables for UI updates
let lastAnnouncedWinners = {};
let lastGameState = null;
let lastCalledNumberTime = 0;
let lastAnnouncedStartTime = 0;

// Update UI based on game state
function updateUI(gameState) {
    const statusText = gameState.gameState ? gameState.gameState.charAt(0).toUpperCase() + gameState.gameState.slice(1) : 'Waiting...';
    gameStatusEl.textContent = statusText;
    if (lastGameState !== gameState.gameState) {
        if (gameState.gameState === 'running') speak("Game started.");
        else if (gameState.gameState === 'ended' && lastGameState === 'running') speak("Game has ended.");
        lastGameState = gameState.gameState;
    }
    if (gameState.lastCalled && gameState.lastCalled.time > lastCalledNumberTime) {
        const num = gameState.lastCalled.number;
        speak(`Number ${numberToWords(num)}`);
        lastCalledNumberTime = gameState.lastCalled.time;
    }
    boardContainer.style.display = (gameState.gameState === 'running') ? 'block' : 'none';
    ticketPriceEl.textContent = gameState.ticketPrice ? `₹${gameState.ticketPrice}` : '--';
    const startTime = gameState.gameStartTime ? new Date(gameState.gameStartTime) : null;
    gameStartTimeEl.textContent = startTime ? startTime.toLocaleString() : 'Not Scheduled';
    if (startTime && startTime.getTime() !== lastAnnouncedStartTime) {
        const timeString = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        speak(`The game is scheduled to start at ${timeString}.`);
        lastAnnouncedStartTime = startTime.getTime();
    }
    document.querySelectorAll('.number.called').forEach(el => el.classList.remove('called'));
    if (gameState.calledNumbers) {
        Object.keys(gameState.calledNumbers).forEach(num => {
            const numEl = document.getElementById(`num-${num}`);
            if (numEl) numEl.classList.add('called');
        });
    }
    calledNumbersList.innerHTML = '';
    if (gameState.calledNumbers) {
        const sortedCalledNumbers = Object.keys(gameState.calledNumbers).map(Number).sort((a, b) => a - b);
        sortedCalledNumbers.forEach(num => {
            const item = document.createElement('div');
            item.className = 'called-number-item';
            item.textContent = num;
            calledNumbersList.appendChild(item);
        });
    }
    renderTickets(gameState.tickets, gameState.calledNumbers);
    awardsInfo.innerHTML = '';
    if (gameState.awards) {
        Object.values(gameState.awards).forEach(award => {
            const awardEl = document.createElement('div');
            let winnerText = 'Pending';
            if (award.winner) {
                winnerText = `🏆 ${award.winner.owner} (Tkt #${award.winner.ticketNumber})`;
                if (!lastAnnouncedWinners[award.key]) {
                    winnerTitle.innerHTML = `🎉 ${award.name} Won! 🎉`;
                    winnerDetails.textContent = `Won by ${award.winner.owner} with Ticket #${award.winner.ticketNumber}`;
                    winnerModal.style.display = 'flex';
                    playWinnerSound();
                    speak(`${award.name} won by ${award.winner.owner} with Ticket number ${award.winner.ticketNumber}`);
                    setTimeout(() => { winnerModal.style.display = 'none'; }, 5000);
                    lastAnnouncedWinners[award.key] = true;
                }
            }
            awardEl.innerHTML = `<span>${award.name} (₹${award.prize || 0}):</span> ${winnerText}`;
            awardsInfo.appendChild(awardEl);
        });
    }
    filterTickets();
}

function main() {
    createBoard();
    let currentGameState = {};
    const gameRef = ref(database, 'tambolaGame/activeGame');

    onValue(gameRef, (snapshot) => {
        const gameState = snapshot.val();
        if (gameState) {
            currentGameState = gameState;
            updateUI(currentGameState);
        } else {
            console.log("No active game found in the database.");
            gameStatusEl.textContent = 'No Game Active';
        }
    });

    setTimeout(() => {
        if (gameStatusEl.textContent === 'Waiting...' || gameStatusEl.textContent === 'Stopped') {
            speak("Game will commence at the time set by admin.");
        }
    }, 2000);
    
    ticketSearch.addEventListener('input', filterTickets);
    document.body.addEventListener('click', () => {
        if (audioContext.state === 'suspended') audioContext.resume();
    }, { once: true });
}

// Run on page load
main();
