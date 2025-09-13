// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getDatabase, ref, onValue, set, update, remove } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js";

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
const setPrizesBtn = document.getElementById('set-prizes-btn');


// Game state reference
const gameRef = ref(database, 'tambolaGame/activeGame');
let currentGameState = {};

// --- Authentication ---
onAuthStateChanged(auth, user => {
    if (user) {
        loginForm.style.display = 'none';
        dashboard.style.display = 'block';
        adminEmail.textContent = user.email;
        initDashboard();
    } else {
        loginForm.style.display = 'block';
        dashboard.style.display = 'none';
    }
});

loginBtn.addEventListener('click', () => {
    signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value)
        .catch(error => { loginError.textContent = error.message; });
});

logoutBtn.addEventListener('click', () => signOut(auth));


// --- Dashboard Initialization ---
function initDashboard() {
    createAdminBoard();
    
    onValue(gameRef, (snapshot) => {
        currentGameState = snapshot.val() || {};
        updateAdminUI();
        // Winner check only if game is running
        if (currentGameState.gameState === 'running') {
            checkAllWinners();
        }
    });
    
    startGameBtn.addEventListener('click', () => update(gameRef, { gameState: 'running' }));
    endGameBtn.addEventListener('click', () => update(gameRef, { gameState: 'ended' }));
    resetGameBtn.addEventListener('click', resetGame);
    setPriceBtn.addEventListener('click', () => update(gameRef, { ticketPrice: Number(document.getElementById('ticket-price').value) }));
    setStartTimeBtn.addEventListener('click', () => update(gameRef, { gameStartTime: new Date(document.getElementById('game-start-time').value).getTime() }));
    generateTicketsBtn.addEventListener('click', () => generateAndSaveTickets(Number(document.getElementById('ticket-limit').value)));
    setPrizesBtn.addEventListener('click', setPrizes);
}

function createAdminBoard() {
    adminNumberBoard.innerHTML = '';
    for (let i = 1; i <= 90; i++) {
        const numberDiv = document.createElement('div');
        numberDiv.className = 'admin-number';
        numberDiv.textContent = i;
        numberDiv.dataset.number = i;
        numberDiv.addEventListener('click', () => callNumber(i));
        adminNumberBoard.appendChild(numberDiv);
    }
}

// --- UI Update Functions ---
function updateAdminUI() {
    gameStateDisplay.textContent = `Current State: ${currentGameState.gameState || 'Not Set'}`;
    
    document.querySelectorAll('.admin-number').forEach(el => {
        el.classList.toggle('called', currentGameState.calledNumbers && currentGameState.calledNumbers[el.dataset.number]);
    });

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

    awardsList.innerHTML = '';
    winnersList.innerHTML = '';
    if (currentGameState.awards) {
        Object.values(currentGameState.awards).forEach(award => {
            // Update prize input fields
            const prizeInput = document.getElementById(`prize-${award.key}`);
            if (prizeInput) prizeInput.value = award.prize;

            const awardItem = document.createElement('li');
            awardItem.innerHTML = `<span>${award.name} (₹${award.prize})</span>`;
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
    if(currentGameState.gameState !== 'running' || (currentGameState.calledNumbers && currentGameState.calledNumbers[num])) {
        return;
    }
    // Voice announcement is now handled on the client-side (index.js)
    const updates = {};
    updates[`/calledNumbers/${num}`] = true;
    // Also store the timestamp to identify the last called number
    updates[`/lastCalled`] = { number: num, time: Date.now() };
    update(gameRef, updates);
}

function saveTicketOwner(ticketId) {
    const ownerName = document.getElementById(`owner-for-${ticketId}`).value;
    update(ref(database, `tambolaGame/activeGame/tickets/ticket_${ticketId}`), { owner: ownerName });
}

function setPrizes() {
    const awards = {
        fullhouse: { key: 'fullhouse', name: "Full House", prize: Number(document.getElementById('prize-fullhouse').value), winner: currentGameState.awards?.fullhouse?.winner || null },
        topline: { key: 'topline', name: "Top Line", prize: Number(document.getElementById('prize-topline').value), winner: currentGameState.awards?.topline?.winner || null },
        middleline: { key: 'middleline', name: "Middle Line", prize: Number(document.getElementById('prize-middleline').value), winner: currentGameState.awards?.middleline?.winner || null },
        bottomline: { key: 'bottomline', name: "Bottom Line", prize: Number(document.getElementById('prize-bottomline').value), winner: currentGameState.awards?.bottomline?.winner || null },
        fourcorners: { key: 'fourcorners', name: "Four Corners", prize: Number(document.getElementById('prize-fourcorners').value), winner: currentGameState.awards?.fourcorners?.winner || null },
        earlyfive: { key: 'earlyfive', name: "Early Five", prize: Number(document.getElementById('prize-earlyfive').value), winner: currentGameState.awards?.earlyfive?.winner || null },
    };
    update(gameRef, { awards });
    alert("Prizes have been set!");
}


function resetGame() {
    if (!confirm("Are you sure? This will reset called numbers, winners, and unbook all tickets.")) return;
    
    const newState = { ...currentGameState, gameState: 'stopped', calledNumbers: null, lastCalled: null };
    if(newState.awards) Object.keys(newState.awards).forEach(k => newState.awards[k].winner = null);
    if(newState.tickets) Object.keys(newState.tickets).forEach(k => newState.tickets[k].owner = 'Unbooked');

    set(gameRef, newState);
}

// --- Ticket Generation (New Logic) ---
function generateAndSaveTickets(limit) {
    if (!limit || limit <= 0) return alert("Please enter a valid ticket limit.");
    
    const tickets = {};
    const generatedRows = new Set(); 

    for (let i = 1; i <= limit; i++) {
        tickets[`ticket_${i}`] = {
            ticketNumber: i,
            owner: 'Unbooked',
            numbers: generateTambolaTicket(generatedRows)
        };
    }
    
    update(gameRef, { tickets: tickets, ticketLimit: limit });
    alert(`${limit} unique tickets generated successfully!`);
}

function generateTambolaTicket(generatedRows) {
    let ticket;
    let isUnique = false;
    let attempts = 0;

    while(!isUnique && attempts < 100) { // Safety break
        ticket = Array(3).fill(null).map(() => Array(9).fill(null));
        
        // Step 1: Determine number of elements per column (1, 2, or 3)
        let colCounts = [1,1,1,1,1,1,1,1,1]; // 9 numbers
        for (let i = 0; i < 6; i++) { // Distribute remaining 6 numbers
            let col;
            do {
                col = Math.floor(Math.random() * 9);
            } while (colCounts[col] >= 3);
            colCounts[col]++;
        }

        // Step 2: Determine which rows get numbers in each column
        let rowCounts = [0,0,0];
        for (let c = 0; c < 9; c++) {
            for (let i = 0; i < colCounts[c]; i++) {
                let row;
                do {
                    row = Math.floor(Math.random() * 3);
                } while(ticket[row][c] !== null || rowCounts[row] >= 5);
                ticket[row][c] = 0; // Placeholder
                rowCounts[row]++;
            }
        }
        
        // If any row doesn't have 5 numbers, this is an invalid layout, restart.
        if (rowCounts.some(count => count !== 5)) {
            attempts++;
            continue;
        }

        // Step 3: Fill the placeholders with actual numbers
        for (let c = 0; c < 9; c++) {
            const start = c * 10 + (c === 0 ? 1 : 0);
            const end = (c === 8) ? 90 : c * 10 + 9;
            const range = Array.from({length: end - start + 1}, (_, i) => start + i);
            
            // Shuffle the range
            for (let i = range.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [range[i], range[j]] = [range[j], range[i]];
            }

            let numIndex = 0;
            for (let r = 0; r < 3; r++) {
                if (ticket[r][c] === 0) {
                    ticket[r][c] = range[numIndex++];
                }
            }
        }

        // Step 4: Check for row uniqueness
        let ticketRowsString = ticket.map(row => JSON.stringify(row.filter(n => n !== null).sort((a,b) => a-b)));
        if (!ticketRowsString.some(rowStr => generatedRows.has(rowStr))) {
            isUnique = true;
            ticketRowsString.forEach(rowStr => generatedRows.add(rowStr));
        }
        attempts++;
    }

    if (!isUnique) {
        console.error("Could not generate a unique ticket after 100 attempts.");
        // Fallback or error handling
    }
    return ticket;
}


// --- Winner Detection Logic ---
function checkAllWinners() {
    if (!currentGameState.tickets || !currentGameState.awards || !currentGameState.calledNumbers) return;
    const { calledNumbers, tickets, awards } = currentGameState;

    Object.values(awards).forEach(award => {
        if (award.winner) return; // Skip if winner already found

        const winningTicket = Object.values(tickets).find(ticket => {
            const ticketNumbers = ticket.numbers.flat().filter(n => n !== null);
            
            switch (award.key) {
                case 'fullhouse':
                    return ticketNumbers.every(num => calledNumbers[num]);
                case 'topline':
                    return ticket.numbers[0].filter(n => n !== null).every(num => calledNumbers[num]);
                case 'middleline':
                    return ticket.numbers[1].filter(n => n !== null).every(num => calledNumbers[num]);
                case 'bottomline':
                    return ticket.numbers[2].filter(n => n !== null).every(num => calledNumbers[num]);
                case 'earlyfive':
                    return ticketNumbers.filter(num => calledNumbers[num]).length >= 5;
                case 'fourcorners': {
                    const topRow = ticket.numbers[0].filter(n => n !== null);
                    const bottomRow = ticket.numbers[2].filter(n => n !== null);
                    if (topRow.length === 0 || bottomRow.length === 0) return false;
                    const corners = [
                        topRow[0],
                        topRow[topRow.length - 1],
                        bottomRow[0],
                        bottomRow[bottomRow.length - 1]
                    ];
                    return corners.every(c => c && calledNumbers[c]);
                }
                default:
                    return false;
            }
        });

        if (winningTicket) {
            console.log(`Winner for ${award.name}: Ticket #${winningTicket.ticketNumber}`);
            const winnerInfo = { owner: winningTicket.owner, ticketNumber: winningTicket.ticketNumber };
            update(ref(database, `tambolaGame/activeGame/awards/${award.key}`), { winner: winnerInfo });
        }
    });
}

