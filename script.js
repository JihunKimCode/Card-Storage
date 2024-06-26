const cardContainer = document.getElementById('card-container');
const cardPopup = document.getElementById('card-popup');
const popupContent = document.getElementById('popup-content');
const scrollTopButton = document.getElementById('scroll-top');
const loadingBar = document.getElementById('loading-bar');
const loadingPercentage = document.getElementById('loading-percentage');

const csvUrl = 'https://raw.githubusercontent.com/JihunKimCode/Card-Storage/main/pokemon_cards.csv';
const apiUrl = 'https://api.pokemontcg.io/v2/';

let cardsData = [];
let csvData = [];
let filteredCards = [];
let displayCardsData = [];
let sortOrder = 1;

// Year in Footer
const currentYear = new Date().getFullYear();
document.getElementById("year").innerHTML = currentYear;
document.getElementById("year2").innerHTML = currentYear;

// Dark Mode Initialization
if (localStorage.getItem("darkMode") === "true") {
    document.body.classList.add("dark-mode");
}

// Toggle Dark Mode
function darkmode() {
    document.body.classList.toggle("dark-mode");
    localStorage.setItem("darkMode", document.body.classList.contains("dark-mode"));
}

// Take CSV file
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        fetchCSVData(file).then(data => {
            document.getElementById('alert').style.display = 'none';
            csvData = data;
            fetchAllSets();
        });
    }
}

// Take CSV data
async function fetchCSVData(file) {
    try {
        const data = await file.text();
        const lines = data.split('\n').filter(line => line.trim()); // Filter out empty lines
        
        // Check if the header has all the required columns
        const header = lines[0].split(',').map(column => column.trim()); // Trim whitespace
        const requiredColumns = ['Name', 'Sets', 'Rarity', 'Artist']; // Adjust column names
        const missingColumns = requiredColumns.filter(column => !header.includes(column));

        if (missingColumns.length > 0) {
            throw new Error('There are some missing columns in CSV');
        }

        // Proceed with data processing
        return lines.slice(1).map(line => {
            const [name, set, rarity, artist, category, detail, holo, count] = line.split(',').map(item => item.trim()); // Trim whitespace
            return { name, set, rarity, artist, category, detail, holo, count };
        });
    } catch (error) {
        alert('Error fetching CSV data: ' + error.message);
        throw error; // Rethrow the error to propagate it further if needed
    }
}


// Fetch to each sets
async function fetchSetData(setName) {
    const formattedSetName = setName.replace(/\s/g, '.');
    const response = await fetch(`${apiUrl}cards?q=set.name:${formattedSetName}`);
    const data = await response.json();
    cardsData = cardsData.concat(data.data);
}

async function fetchCardData(name, set, rarity, artist) {
    const formattedName = name.replace(/\s/g, '.');

    try {
        let cards = await fetchCardsByName(formattedName);
        if (!cards) return null;

        // Filter by set name if available
        let matchedCards = filterCardsBySet(cards, set);
        if (matchedCards.length === 0) {
            matchedCards = cards;
        }

        // Further filter by rarity if specified
        if (rarity !== "N/A" && rarity !== undefined) {
            matchedCards = filterCardsByRarity(matchedCards, rarity);
        }

        // Further filter by artist if specified
        if (matchedCards.length > 1 && artist) {
            matchedCards = filterCardsByArtist(matchedCards, artist);
        }

        // Update cardsData with fetched cards
        cardsData = cardsData.concat(matchedCards);
        return matchedCards.length > 0 ? matchedCards[0] : await fetchCardByNameAndRarity(formattedName, rarity);
    } catch (error) {
        console.error('Error fetching card data:', error);
        return null;
    }
}

async function fetchCardsByName(name) {
    try {
        let response = await fetch(`${apiUrl}cards?q=name:${name}`);
        let data = await response.json();
        return data.data.length > 0 ? data.data : null;
    } catch (error) {
        console.error('Error fetching cards by name:', error);
        return null;
    }
}

function filterCardsBySet(cards, set) {
    return cards.filter(card => card.set.name.includes(set));
}

function filterCardsByRarity(cards, rarity) {
    return cards.filter(card => card.rarity === rarity);
}

function filterCardsByArtist(cards, artist) {
    return cards.filter(card => card.artist === artist);
}

async function fetchCardByNameAndRarity(name, rarity) {
    const formattedName = name.replace(/\s/g, '.');

    // Check if rarity is undefined
    if (rarity === undefined) {
        throw new Error('Rarity parameter is missing');
    }

    try {
        let response = await fetch(`${apiUrl}cards?q=name:${formattedName} rarity:${rarity.replace(/\s/g, '.')}`);
        let data = await response.json();
        return data.data.length > 0 ? data.data[0] : await fetchCardsByName(name);
    } catch (error) {
        console.error('Error fetching card by name and rarity:', error);
        return await fetchCardsByName(name);
    }
}

// Take all sets information to reduce number of fetches
async function fetchAllSets() {
    const sets = [...new Set(csvData.map(card => card.set))];
    const totalSets = sets.length;
    let loadedSets = 0;

    for (let set of sets) {
        if (set !== "N/A" && set !== undefined) {
            await fetchSetData(set);
        }

        loadedSets++;
        const progress = (loadedSets / totalSets) * 100;
        loadingBar.style.width = `${progress}%`;
        loadingPercentage.innerText = `${Math.round(progress)}%`;
    }

    loadingBar.style.display = 'none';
    loadingPercentage.style.display = 'none';

    populateFilters();
    filteredCards = csvData;
    await createDisplayCardsData();
    displayCards();
}

async function createDisplayCardsData() {
    displayCardsData = []; // Clear previous data
    for (const { name, set, rarity, artist, holo, count } of filteredCards) {
        if (!name) {
            console.error('Card name is blank or undefined');
            continue; // Skip this card
        }

        let card = cardsData.find(c => c.name === name && c.set.name === set && c.rarity === rarity && c.artist === artist);
        if (!card) {
            card = await fetchCardData(name, set, rarity, artist);
        }
        if (card) {
            // Store additional information
            const releaseDate = card.set.releaseDate || '';
            const price = getPrice(card) || 0;
            displayCardsData.push({ ...card, releaseDate, price, holo, count });
        } else {
            console.error(`Card not found: ${name}`);
        }
    }
}

// Fill the card container
function displayCards() {
    cardContainer.innerHTML = ''; // Clear the card container
    displayCardsData.forEach(card => {
        createCardElement(card);
    });
}

// Make Card Element
function createCardElement(card) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';

    // Determine holo symbol
    let holoSymbol = '';
    if (card.holo === "Holo") {
        holoSymbol = '✨';
    } else if (card.holo === "Reverse") {
        holoSymbol = '🌟';
    }

    // Add count to the card name if count is more than 1
    const countText = card.count > 1 ? ` (${card.count})` : '';

    cardDiv.innerHTML = `
        <img src="${card.images.small}" alt="${card.name}" title="${card.name}" onclick="showPopup('${card.images.large}', '${card.name.replace(/'/g, '’')}')" style="cursor: zoom-in">
        <img src="${card.set.images.logo}" alt="${card.set.name}" title="${card.set.name}" style="width: 100px; cursor: default">
        <p><b>${card.name}${holoSymbol}${countText}</b></p>
        <p><i>Illus. ${card.artist || 'N/A'}</i></p>
        <p>${card.releaseDate || 'N/A'}</p>
        <p>${card.rarity || 'N/A'}</p>
        <p>
            ${card.tcgplayer && card.tcgplayer.url 
            ? `<a href="${card.tcgplayer.url}" target="_blank">Avg $${card.price || 'N/A'}</a>` 
            : `Avg $${card.price || 'N/A'}`}
        </p>
    `;
    cardContainer.appendChild(cardDiv);
}

function getPrice(card) {
    const priceAttributes = ['unlimited', '1stEdition', 'unlimitedHolofoil', '1stEditionHolofoil', 'normal', 'holofoil', 'reverseHolofoil'];
    for (const attr of priceAttributes) {
        const price = card.tcgplayer?.prices?.[attr]?.mid;
        if (price !== undefined) {
            return price;
        }
    }
    return 0;
}

function showPopup(image, name) {
    const popup = document.getElementById('popup');
    const popupImage = document.getElementById('popupImage');

    popup.style.display = "block";
    popupImage.src = image;
    document.body.style.overflow = "hidden";

    const close = document.getElementsByClassName('close')[0];
    close.onclick = function () {
        popup.style.display = "none";
        document.body.style.overflow = "auto";
    };

    window.onclick = function (event) {
        if (event.target == popup) {
            popup.style.display = "none";
            document.body.style.overflow = "auto";
        }
    };
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.onscroll = function () {
    if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
        scrollTopButton.style.display = 'block';
    } else {
        scrollTopButton.style.display = 'none';
    }
};

// Function to disable filter inputs
function disableFilters() {
    document.getElementById('rarity-filter').disabled = true;
    document.getElementById('set-filter').disabled = true;
    document.getElementById('detail-filter').disabled = true;
    document.getElementById('artist-filter').disabled = true;
    document.getElementById('holo-filter').disabled = true;
    document.getElementById('sort-by').disabled = true;
    document.getElementById('order-toggle').disabled = true;
}

// Function to enable filter inputs
function enableFilters() {
    document.getElementById('rarity-filter').disabled = false;
    document.getElementById('set-filter').disabled = false;
    document.getElementById('detail-filter').disabled = false;
    document.getElementById('artist-filter').disabled = false;
    document.getElementById('holo-filter').disabled = false;
    document.getElementById('sort-by').disabled = false;
    document.getElementById('order-toggle').disabled = false;
}

function populateFilters() {
    const rarityFilter = document.getElementById('rarity-filter');
    const setFilter = document.getElementById('set-filter');
    const detailFilter = document.getElementById('detail-filter');
    const artistFilter = document.getElementById('artist-filter');
    const holoFilter = document.getElementById('holo-filter');
    const countFilter = document.getElementById('count-filter');

    // Sort rarity
    const rarities = [...new Set(csvData.map(card => card.rarity).filter(rarity => rarity && rarity !== "N/A"))]
    .sort((a, b) => {
        const orderA = rarityOrder[a] || 0;
        const orderB = rarityOrder[b] || 0;
        if (orderA === orderB) return a.localeCompare(b);  // Alphabetical comparison if order is the same
        return orderA - orderB;
    });

    // Sort them alphabetically
    const sets = [...new Set(csvData.map(card => card.set).filter(set => set && set !== "N/A"))].sort();
    const details = [...new Set(csvData.map(card => card.detail).filter(detail => detail && detail !== "N/A"))].sort();
    const artists = [...new Set(csvData.map(card => card.artist).filter(artist => artist && artist !== "N/A"))].sort();
    const holos = [...new Set(csvData.map(card => card.holo).filter(holo => holo && holo !== "N/A"))].sort();

    // Populate rarity filter
    rarities.forEach(rarity => {
        const option = document.createElement('option');
        option.value = rarity;
        option.textContent = rarity;
        rarityFilter.appendChild(option);
    });

    // Populate set filter
    sets.forEach(set => {
        const option = document.createElement('option');
        option.value = set;
        option.textContent = set;
        setFilter.appendChild(option);
    });

    // Populate detail filter
    details.forEach(detail => {
        const option = document.createElement('option');
        option.value = detail;
        option.textContent = detail;
        detailFilter.appendChild(option);
    });

    // Populate artist filter
    artists.forEach(artist => {
        const option = document.createElement('option');
        option.value = artist;
        option.textContent = artist;
        artistFilter.appendChild(option);
    });

    // Populate holo filter
    holos.forEach(holo => {
        const option = document.createElement('option');
        option.value = holo;
        option.textContent = holo;
        holoFilter.appendChild(option);
    });

    // Populate count filter with unique counts from the csvData
    const counts = [...new Set(csvData.map(card => card.count).filter(count => count && count !== "N/A"))].sort((a, b) => a - b);
    counts.forEach(count => {
        const option = document.createElement('option');
        option.value = count;
        option.textContent = count;
        countFilter.appendChild(option);
    });
}

document.getElementById('rarity-filter').addEventListener('change', applyFilters);
document.getElementById('set-filter').addEventListener('change', applyFilters);
document.getElementById('detail-filter').addEventListener('change', applyFilters);
document.getElementById('artist-filter').addEventListener('change', applyFilters);
document.getElementById('holo-filter').addEventListener('change', applyFilters);
document.getElementById('count-filter').addEventListener('change', applyFilters);
document.getElementById('sort-by').addEventListener('change', sortAndDisplayCards);
document.getElementById('order-toggle').addEventListener('click', () => {
    sortOrder *= -1;
    sortAndDisplayCards();
});

async function applyFilters() {
    disableFilters(); // Disable filters while applying
    const rarityFilter = document.getElementById('rarity-filter').value;
    const setFilter = document.getElementById('set-filter').value;
    const detailFilter = document.getElementById('detail-filter').value;
    const artistFilter = document.getElementById('artist-filter').value;
    const holoFilter = document.getElementById('holo-filter').value;
    const countFilter = document.getElementById('count-filter').value;

    filteredCards = csvData.filter(card => {
        return (!rarityFilter || card.rarity === rarityFilter) &&
               (!setFilter || card.set === setFilter) &&
               (!detailFilter || card.detail === detailFilter) &&
               (!artistFilter || card.artist === artistFilter) &&
               (!holoFilter || card.holo === holoFilter) &&
               (!countFilter || card.count == countFilter);
    });

    // Filter displayCardsData directly without fetching new data
    displayCardsData = filteredCards.map(({ name, set, rarity, artist, holo, count }) => {
        if (!name) {
            console.error('Card name is blank or undefined');
            return null;
        }
        let card = cardsData.find(c => c.name === name && c.set.name === set && c.rarity === rarity && c.artist === artist);
        if (!card) card = cardsData.find(c => c.name === name && c.rarity === rarity && c.artist === artist);
        if (!card) card = cardsData.find(c => c.name === name && c.artist === artist);
        if (!card) card = cardsData.find(c => c.name === name);
        if (card) {
            const releaseDate = card.set.releaseDate || '';
            const price = getPrice(card) || 0;
            return { ...card, releaseDate, price, holo, count };
        } else {
            console.error(`Card not found: ${name}`);
            return null;
        }
    }).filter(Boolean); // Filter out null values

    sortAndDisplayCards();
    enableFilters(); // Re-enable filters after applying
}

function sortAndDisplayCards() {
    disableFilters(); // Disable filters while sorting
    const sortBy = document.getElementById('sort-by').value;

    displayCardsData.sort((a, b) => {
        let compare = 0;
        if (sortBy === 'name') {
            compare = a.name.localeCompare(b.name);
        } else if (sortBy === 'rarity') {
            compare = (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0);
        } else if (sortBy === 'releaseDate') {
            compare = (a.releaseDate || '').localeCompare(b.releaseDate || '');
        } else if (sortBy === 'price') {
            compare = b.price - a.price;
        } else if (sortBy === 'artist') {
            compare = (a.artist || '').localeCompare(b.artist || '');
        }
        return compare * sortOrder;
    });

    displayCards();
    enableFilters(); // Re-enable filters after sorting
}

// Rarity Order for sorting
const rarityOrder = {
    "Common": 1,
    "Uncommon": 2,
    "Rare": 3,
    "Radiant Rare": 3,
    "Amazing Rare": 4,
    "Double Rare": 4,
    "Rare Holo": 5,
    "Rare ACE": 5,
    "Ultra Rare": 6,
    "Rare Ultra": 6,
    "Rare Shiny": 6,
    "Shiny Rare": 6,
    "Illustration Rare": 6,
    "Rare Holo Star": 6,
    "Rare Prism Star": 6,
    "Rare Holo LV.X": 6,
    "LEGEND": 6,
    "Rare BREAK": 6,
    "Rare Prime": 6,
    "Rare Holo EX": 6,
    "Rare Holo GX": 6,
    "Rare Holo V": 6,
    "Rare Holo VSTAR": 7,
    "Rare Holo VMAX": 7,
    "Rare Secret": 7,
    "Trainer Gallery Rare Holo": 7,
    "Rare Rainbow": 7,
    "Rare Shining": 7,
    "Rare Shiny GX": 7,
    "ACE SPEC Rare": 7,
    "Shiny Ultra Rare": 7,
    "Special Illustration Rare": 8,
    "Hyper Rare": 9,
    "Promo": 9,
};