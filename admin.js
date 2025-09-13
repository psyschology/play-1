// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getDatabase, ref, onValue, set, update, remove } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js";

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
const auth = getAuth(app);
const database = getDatabase(app);

// DOM Elements
const loginForm = document.getElementById('login-form');
const dashboard = document.getElementById('dashboard');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginError = document.getElementById('login-error');
const adminEmail = document.getElementById('admin-email');

const startGameBtn = document.getElementById('start-game-btn');
const endGameBtn = document.getElementById('end-game-btn');
const resetGameBtn = document.getElementById('reset-game-btn');
const gameStateDisplay = document.getElementById('game-state-display');

const adminNumberBoard = document.getElementById('admin-number-board');
const setPriceBtn = document.getElementById('set-price-btn');
const generateTicketsBtn = document.getElementById('generate-tickets-btn');
const setStartTimeBtn = document.getElementById('set-start-time-btn');

const ticketsList = document.getElementById('tickets-management-list');
const awardsList = document.getElementById('awards-list');
const winnersList = document.getElementById('winners-list');
const addAwardBtn = document.getElementById('add-award-btn');

// Game state reference
const gameRef = ref(database, 'tambolaGame/activeGame');
let currentGameState = {};

// --- Authentication ---
onAuthStateChanged(auth, user => {
    if (user) {
        // User is signed in
        loginForm.style.display = 'none';
        dashboard.style.display = 'block';
        adminEmail.textContent = user.email;
        initDashboard();
    } else {
        // User is signed out
        loginForm.style.display = 'block';
        dashboard.style.display = 'none';
    }
});

loginBtn.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    signInWithEmailAndPassword(auth, email, password)
        .catch(error => {
            loginError.textContent = error.message;
        });
});

logoutBtn.addEventListener('click', () => {
    signOut(auth);
});

// --- Dashboard Initialization ---
function initDashboard() {
    createAdminBoard();
    
    // Listen for real-time updates from Firebase
    onValue(gameRef, (snapshot) => {
        const data = snapshot.val();
        currentGameState = data || {}; // If no data, use empty object
        updateAdminUI();
        checkAllWinners(); // Check for winners on every data change
    });
    
    // Attach event listeners
    startGameBtn.addEventListener('click', () => update(gameRef, { gameState: 'running' }));
    endGameBtn.addEventListener('click', () => update(gameRef, { gameState: 'ended' }));
    resetGameBtn.addEventListener('click', resetGame);
    setPriceBtn.addEventListener('click', () => {
        const price = document.getElementById('ticket-price').value;
        update(gameRef, { ticketPrice: Number(price) });
    });
    setStartTimeBtn.addEventListener('click', () => {
        const time = document.getElementById('game-start-time').value;
        update(gameRef, { gameStartTime: new Date(time).getTime() });
    });
    generateTicketsBtn.addEventListener('click', () => {
        const limit = document.getElementById('ticket-limit').value;
        generateAndSaveTickets(Number(limit));
    });
    addAwardBtn.addEventListener('click', addAward);
}

function createAdminBoard() {
    adminNumberBoard.innerHTML = '';
    for (let i = 1; i <= 90; i++) {
        const numberDiv = document.createElement('div');
        numberDiv.classList.add('admin-number');
        numberDiv.textContent = i;
        numberDiv.dataset.number = i;
        numberDiv.addEventListener('click', () => callNumber(i));
        adminNumberBoard.appendChild(numberDiv);
    }
}

// --- UI Update Functions ---
function updateAdminUI() {
    gameStateDisplay.textContent = `Current State: ${currentGameState.gameState || 'Not Set'}`;
    
    // Update number board
    document.querySelectorAll('.admin-number').forEach(el => {
        const num = el.dataset.number;
        if (currentGameState.calledNumbers && currentGameState.calledNumbers[num]) {
            el.classList.add('called');
        } else {
            el.classList.remove('called');
        }
    });

    // Update tickets list
    ticketsList.innerHTML = '';
    if (currentGameState.tickets) {
        Object.values(currentGameState.tickets).forEach(ticket => {
            const item = document.createElement('div');
            item.className = 'ticket-admin-item';
            item.innerHTML = `
                <span>Ticket #${ticket.ticketNumber}</span>
                <input type="text" value="${ticket.owner}" placeholder="Owner Name" id="owner-for-${ticket.ticketNumber}">
                <button class="primary" data-ticket-id="${ticket.ticketNumber}">Save</button>
            `;
            item.querySelector('button').addEventListener('click', (e) => saveTicketOwner(e.target.dataset.ticketId));
            ticketsList.appendChild(item);
        });
    }

    // Update awards and winners list
    awardsList.innerHTML = '';
    winnersList.innerHTML = '';
    if (currentGameState.awards) {
        Object.entries(currentGameState.awards).forEach(([key, award]) => {
            const awardItem = document.createElement('li');
            awardItem.innerHTML = `<span>${award.name}</span> <button data-key="${key}" class="end">X</button>`;
            awardItem.querySelector('button').onclick = () => remove(ref(database, `tambolaGame/activeGame/awards/${key}`));
            awardsList.appendChild(awardItem);
            
            if(award.winner) {
                const winnerItem = document.createElement('li');
                winnerItem.innerHTML = `<span>${award.name}:</span> ${award.winner.owner} (Ticket #${award.winner.ticketNumber})`;
                winnersList.appendChild(winnerItem);
            }
        });
    }
}

// --- Game Logic Functions ---
function callNumber(num) {
    if(currentGameState.gameState !== 'running') {
        alert("Game is not running. Please start the game first.");
        return;
    }
    const updates = {};
    updates[`/calledNumbers/${num}`] = true;
    update(gameRef, updates);
}

function saveTicketOwner(ticketId) {
    const ownerName = document.getElementById(`owner-for-${ticketId}`).value;
    update(ref(database, `tambolaGame/activeGame/tickets/ticket_${ticketId}`), { owner: ownerName });
}

function addAward() {
    const awardNameInput = document.getElementById('award-name');
    const awardName = awardNameInput.value.trim();
    if (!awardName) return;
    const key = awardName.toLowerCase().replace(/\s+/g, '');
    const updates = {};
    updates[`/awards/${key}`] = { name: awardName, winner: null };
    update(gameRef, updates);
    awardNameInput.value = '';
}

function resetGame() {
    if (!confirm("Are you sure you want to reset the entire game? This will clear all called numbers, winners, and unbook all tickets.")) return;
    
    const newState = {
        ...currentGameState, // keep settings like price, etc.
        gameState: 'stopped',
        calledNumbers: null,
    };

    // Reset winners for all awards
    if(newState.awards) {
        for(const key in newState.awards) {
            newState.awards[key].winner = null;
        }
    }
    
    // Reset ticket owners
    if(newState.tickets) {
        for(const key in newState.tickets) {
            newState.tickets[key].owner = 'Unbooked';
        }
    }

    set(gameRef, newState);
}

// --- Ticket Generation ---
function generateAndSaveTickets(limit) {
    if (!limit || limit <= 0) {
        alert("Please enter a valid ticket limit.");
        return;
    }
    
    const tickets = {};
    for (let i = 1; i <= limit; i++) {
        tickets[`ticket_${i}`] = {
            ticketNumber: i,
            owner: 'Unbooked',
            numbers: generateTambolaTicket()
        };
    }
    
    update(gameRef, { tickets: tickets, ticketLimit: limit });
    alert(`${limit} tickets generated successfully!`);
}

function generateTambolaTicket() {
    // This is a simplified ticket generation algorithm
    let ticket = Array(3).fill(null).map(() => Array(9).fill(null));
    let numbers = new Set();
    
    // Columns are 0-8
    // Column 0: 1-9, Column 1: 10-19, ..., Column 8: 80-90
    for(let c = 0; c < 9; c++) {
        const start = c * 10 + (c === 8 ? 0 : 1);
        const end = c * 10 + 10;
        const colNumbers = [];
        while(colNumbers.length < 1) { // Ensure at least 1 number per column
            let num = Math.floor(Math.random() * (end - start + 1)) + start;
            if(num > 90) num = 90;
            if(!colNumbers.includes(num)) colNumbers.push(num);
        }
        colNumbers.sort((a,b) => a - b);
        let placed = 0;
        while(placed < colNumbers.length) {
            let row = Math.floor(Math.random() * 3);
            if(ticket[row][c] === null) {
                ticket[row][c] = colNumbers[placed];
                placed++;
            }
        }
    }

    // Distribute remaining numbers to have 5 per row
    let totalNumbers = 9;
    while(totalNumbers < 15) {
        let r = Math.floor(Math.random() * 3);
        let c = Math.floor(Math.random() * 9);

        const rowCount = ticket[r].filter(n => n !== null).length;
        if(ticket[r][c] === null && rowCount < 5) {
            const start = c * 10 + (c === 8 ? 0 : 1);
            const end = c * 10 + 10;
            let num;
            let existsInCol = true;
            while(existsInCol) {
                num = Math.floor(Math.random() * (end - start + 1)) + start;
                if(num > 90) num = 90;
                existsInCol = ticket[0][c] === num || ticket[1][c] === num || ticket[2][c] === num;
            }
            ticket[r][c] = num;
            totalNumbers++;
        }
    }

    // Sort numbers within each column
    for(let c = 0; c < 9; c++) {
        let colVals = [];
        for(let r = 0; r < 3; r++) {
            if(ticket[r][c] !== null) colVals.push(ticket[r][c]);
        }
        colVals.sort((a,b) => a-b);
        let valIndex = 0;
        for(let r = 0; r < 3; r++) {
            if(ticket[r][c] !== null) {
                ticket[r][c] = colVals[valIndex++];
            }
        }
    }

    return ticket;
}


// --- Winner Detection Logic ---
function checkAllWinners() {
    if (!currentGameState.tickets || !currentGameState.awards || !currentGameState.calledNumbers) return;

    const called = currentGameState.calledNumbers;
    const tickets = Object.values(currentGameState.tickets);

    // Iterate over each award definition
    Object.entries(currentGameState.awards).forEach(([key, award]) => {
        // If this award already has a winner, skip it
        if (award.winner) return;

        // Find the first ticket that satisfies the winning condition for this award
        const winningTicket = tickets.find(ticket => {
            // Get all 15 numbers from the ticket grid
            const ticketNumbers = ticket.numbers.flat().filter(n => n !== null);
            
            if (key === 'fullHouse') {
                return ticketNumbers.every(num => called[num]);
            }
            if (key === 'firstRow') {
                return ticket.numbers[0].filter(n => n !== null).every(num => called[num]);
            }
            if (key === 'secondRow') {
                return ticket.numbers[1].filter(n => n !== null).every(num => called[num]);
            }
            if (key === 'thirdRow') {
                return ticket.numbers[2].filter(n => n !== null).every(num => called[num]);
            }
            // Add other award logic here like 'earlyFive' or 'fourCorners'
            if (key === 'earlyFive') {
                const calledCount = ticketNumbers.filter(num => called[num]).length;
                return calledCount >= 5;
            }
            if (key === 'fourCorners') {
                const firstRow = ticket.numbers[0].filter(n => n !== null);
                const lastRow = ticket.numbers[2].filter(n => n !== null);
                const corners = [firstRow[0], firstRow[firstRow.length-1], lastRow[0], lastRow[lastRow.length-1]];
                return corners.every(num => num && called[num]);
            }
            return false;
        });

        // If a winner was found for this category, update Firebase
        if (winningTicket) {
            console.log(`Winner found for ${award.name}: Ticket #${winningTicket.ticketNumber}`);
            const winnerInfo = { 
                owner: winningTicket.owner, 
                ticketNumber: winningTicket.ticketNumber 
            };
            const updates = {};
            updates[`/awards/${key}/winner`] = winnerInfo;
            update(gameRef, updates);
        }
    });
}
