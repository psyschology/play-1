// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js";

// --- START: PASTE YOUR FIREBASE CONFIGURATION HERE ---
 const firebaseConfig = {
    apiKey: "AIzaSyBZ9VKH0SVMOYdvYOO_XY_ycjB0C1ty_BU",
    authDomain: "play-2b9e2.firebaseapp.com",
    projectId: "play-2b9e2",
    storageBucket: "play-2b9e2.firebasestorage.app",
    messagingSenderId: "717502298791",
    appId: "1:717502298791:web:a170ed9239e5df21987982",
    measurementId: "G-97HGFBY9QJ"
  };
// --- END: PASTE YOUR FIREBASE CONFIGURATION HERE ---

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
const winnerBanner = document.getElementById('winner-banner');
const awardsInfo = document.getElementById('awards-info');
const ticketSearch = document.getElementById('ticket-search');

// State
let lastAnnouncedWinners = {};

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
    
    // Show/Hide board
    if (gameState.gameState === 'running') {
        boardContainer.style.display = 'block';
    } else {
        boardContainer.style.display = 'none';
    }

    // Ticket Price
    ticketPriceEl.textContent = gameState.ticketPrice ? `$${gameState.ticketPrice}` : '--';

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
                winnerText = `🏆 ${award.winner.owner} (Ticket #${award.winner.ticketNumber})`;
                // Check if this is a new winner announcement
                if (!lastAnnouncedWinners[key]) {
                    winnerBanner.textContent = `${award.name} won by ${award.winner.owner} with Ticket #${award.winner.ticketNumber}!`;
                    winnerBanner.style.display = 'block';
                    setTimeout(() => { winnerBanner.style.display = 'none'; }, 5000);
                    lastAnnouncedWinners[key] = true;
                }
            }
            awardEl.innerHTML = `<span>${award.name}:</span> ${winnerText}`;
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

// Main function
function main() {
    createBoard();
    
    const gameRef = ref(database, 'tambolaGame/activeGame');
    onValue(gameRef, (snapshot) => {
        const gameState = snapshot.val();
        if (gameState) {
            updateUI(gameState);
        } else {
            // Handle case where no game data is available
            console.log("No active game found in the database.");
            gameStatusEl.textContent = 'No Game Active';
        }
    });

    ticketSearch.addEventListener('input', filterTickets);
}

// Run on page load
main();
