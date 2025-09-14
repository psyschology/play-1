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

// ... existing code ...
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
    const updates = {};
    updates[`/calledNumbers/${num}`] = true;
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

// --- Ticket Generation ---
function generateAndSaveTickets(limit) {
    if (!limit || limit <= 0) return alert("Please enter a valid ticket limit.");
    
    const tickets = {};
    for (let i = 1; i <= limit; i++) {
        tickets[`ticket_${i}`] = {
            ticketNumber: i,
            owner: 'Unbooked',
            numbers: generateTambolaTicket()
        };
    }
    
    update(gameRef, { tickets: tickets, ticketLimit: limit });
    alert(`${limit} unique tickets generated successfully!`);
}

/**
 * Attempts to generate a single valid ticket layout.
 * It ensures each row has 5 numbers and validates that no column is left empty.
 * Returns null if the layout is invalid, so the main function can try again.
 */
function attemptTicketGeneration() {
    const ticket = Array.from({ length: 3 }, () => Array(9).fill(null));
    const colCounts = Array(9).fill(0);

    // Step 1: For each row, randomly pick 5 columns to place a placeholder.
    // This guarantees every row has exactly 5 numbers.
    for (let r = 0; r < 3; r++) {
        const colIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8];
        colIndices.sort(() => Math.random() - 0.5); // shuffle
        const selectedCols = colIndices.slice(0, 5);
        for (const c of selectedCols) {
            ticket[r][c] = 0; // Use 0 as a placeholder for a number
        }
    }

    // Step 2: Validate the generated layout by checking the columns.
    for (let c = 0; c < 9; c++) {
        for (let r = 0; r < 3; r++) {
            if (ticket[r][c] !== null) {
                colCounts[c]++;
            }
        }
    }

    // Rule: No column can be empty. If one is, this layout is invalid.
    if (colCounts.some(count => count === 0)) {
        return null; // This attempt failed, the calling function will try again.
    }
    
    // Rule: No column can have more than 3 numbers.
    if (colCounts.some(count => count > 3)) {
        return null; // Also an invalid layout.
    }

    // Step 3: The layout is valid. Now, fill the placeholders with real, sorted numbers.
    for (let c = 0; c < 9; c++) {
        const numInCol = colCounts[c];
        if (numInCol > 0) {
            // Rule: Define the correct number range for the current column.
            const rangeStart = c * 10 + (c === 0 ? 1 : 0);
            const rangeEnd = (c === 8) ? 90 : c * 10 + 9; // Correctly handles the last column (80-90)
            
            const numbersPool = [];
            for (let i = rangeStart; i <= rangeEnd; i++) {
                numbersPool.push(i);
            }
            
            // Randomly select the required amount of unique numbers for the column.
            numbersPool.sort(() => Math.random() - 0.5);
            const numbersToPlace = numbersPool.slice(0, numInCol).sort((a, b) => a - b);

            // Rule: Place the numbers in ascending order from top to bottom.
            let numberIdx = 0;
            for (let r = 0; r < 3; r++) {
                if (ticket[r][c] === 0) {
                    ticket[r][c] = numbersToPlace[numberIdx];
                    numberIdx++;
                }
            }
        }
    }
    
    return ticket;
}

/**
 * This is the main ticket generation function called by your app.
 * It guarantees a valid ticket is returned by repeatedly attempting generation
 * until a valid layout is created.
 */
function generateTambolaTicket() {
    let ticket = null;
    let attempts = 0;
    // The loop now includes a safeguard against rare infinite loops.
    while (ticket === null && attempts < 500) { 
        ticket = attemptTicketGeneration();
        attempts++;
    }
    // If it fails after many attempts, return a blank ticket to avoid crashing.
    if (ticket === null) {
        console.error("Failed to generate a valid ticket after 500 attempts.");
        return Array.from({ length: 3 }, () => Array(9).fill(null));
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
            // Ensure ticket.numbers is a valid 2D array before processing
            if (!Array.isArray(ticket.numbers) || !ticket.numbers.every(row => Array.isArray(row) || row === null)) {
                 return false;
            }
            
            const ticketNumbers = ticket.numbers.flat().filter(n => n !== null);
            
            switch (award.key) {
                case 'fullhouse':
                    return ticketNumbers.length === 15 && ticketNumbers.every(num => calledNumbers[num]);
                case 'topline':
                    return ticket.numbers[0] && ticket.numbers[0].filter(n => n !== null).length === 5 && ticket.numbers[0].filter(n => n !== null).every(num => calledNumbers[num]);
                case 'middleline':
                     return ticket.numbers[1] && ticket.numbers[1].filter(n => n !== null).length === 5 && ticket.numbers[1].filter(n => n !== null).every(num => calledNumbers[num]);
                case 'bottomline':
                     return ticket.numbers[2] && ticket.numbers[2].filter(n => n !== null).length === 5 && ticket.numbers[2].filter(n => n !== null).every(num => calledNumbers[num]);
                case 'earlyfive':
                    return ticketNumbers.filter(num => calledNumbers[num]).length >= 5;
                case 'fourcorners': {
                    if (!ticket.numbers[0] || !ticket.numbers[2]) return false;

                    const topRowNumbers = ticket.numbers[0].filter(n => n !== null);
                    const bottomRowNumbers = ticket.numbers[2].filter(n => n !== null);

                    if (topRowNumbers.length === 0 || bottomRowNumbers.length === 0) return false;
                    
                    const firstTop = topRowNumbers[0];
                    const lastTop = topRowNumbers[topRowNumbers.length - 1];
                    const firstBottom = bottomRowNumbers[0];
                    const lastBottom = bottomRowNumbers[bottomRowNumbers.length - 1];
                    
                    const corners = [firstTop, lastTop, firstBottom, lastBottom];
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
