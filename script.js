// Components
const cardContainer = document.getElementById('card-container');
const cardPopup = document.getElementById('card-popup');
const popupContent = document.getElementById('popup-content');
const scrollTopButton = document.getElementById('scroll-top');
const loadingBar = document.getElementById('loading-bar');
const loadingContext = document.getElementById('loading-context');

// Filters
const rarityFilter = document.getElementById('rarity-filter');
const setFilter = document.getElementById('set-filter');
const artistFilter = document.getElementById('artist-filter');
const typeFilter = document.getElementById('type-filter');
const holoFilter = document.getElementById('holo-filter');
const countFilter = document.getElementById('count-filter');

// URLs
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
        typeFilter.innerHTML += `<option value="">🔍${header[4]||''}</option>`;
        holoFilter.innerHTML += `<option value="">🔍${header[5]||''}</option>`;
        countFilter.innerHTML += `<option value="">🔍${header[6]||''}</option>`;
        const requiredColumns = ['Name', 'Sets', 'Rarity', 'Artist']; // Adjust column names
        const missingColumns = requiredColumns.filter(column => !header.includes(column));

        if (missingColumns.length > 0) {
            throw new Error('There are some missing columns in CSV');
        }

        // Proceed with data processing
        return lines.slice(1).map(line => {
            const [name, set, rarity, artist, type, holo, count] = line.split(',').map(item => item.trim()); // Trim whitespace
            return { name, set, rarity, artist, type, holo, count };
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

const cache = {};

async function fetchCardData(name, set, rarity, artist) {
    const formattedName = name.replace(/\s/g, '.');

    // Check if data is already cached
    if (cache[formattedName]) {
        let cards = cache[formattedName];
        let matchedCards = filterCardsBySet(cards, set);
        if (matchedCards.length === 0) {
            matchedCards = cards;
        }
        if (rarity !== "N/A" && rarity !== undefined) {
            matchedCards = filterCardsByRarity(matchedCards, rarity);
        }
        if (matchedCards.length > 1 && artist) {
            matchedCards = filterCardsByArtist(matchedCards, artist);
        }
        return matchedCards.length > 0 ? matchedCards[0] : await fetchCardByNameAndRarity(formattedName, rarity);
    }

    try {
        let cards = await fetchCardsByName(formattedName);
        if (!cards) return null;

        // Cache the fetched cards
        cache[formattedName] = cards;

        // Filter as per the provided criteria
        let matchedCards = filterCardsBySet(cards, set);
        if (matchedCards.length === 0) {
            matchedCards = cards;
        }
        if (rarity !== "N/A" && rarity !== undefined) {
            matchedCards = filterCardsByRarity(matchedCards, rarity);
        }
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
        if (!response.ok) throw new Error(`Failed to fetch cards by name: ${name}`);
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

    if (rarity === undefined) {
        throw new Error('Rarity parameter is missing');
    }

    try {
        let response = await fetch(`${apiUrl}cards?q=name:${formattedName} rarity:${rarity.replace(/\s/g, '.')}`);
        if (!response.ok) throw new Error(`Failed to fetch cards by name and rarity: ${name}, ${rarity}`);
        let data = await response.json();
        return data.data.length > 0 ? data.data[0] : await fetchCardsByName(name);
    } catch (error) {
        console.error('Error fetching card by name and rarity:', error);
        return await fetchCardsByName(name);
    }
}

// Take all sets information to reduce number of fetches
async function fetchAllSets() {
    loadingContext.innerText = 'Fetching Sets...';
    const sets = [...new Set(csvData.map(card => card.set))];
    const validSets = sets.filter(set => set !== "N/A" && set !== undefined);

    // Prepare an array of fetch promises with error handling
    const fetchPromises = validSets.map(async (set) => {
        const formattedSetName = set.replace(/\s/g, '.');
        try {
            const response = await fetch(`${apiUrl}cards?q=set.name:${formattedSetName}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch data for set: ${set}. Status: ${response.status}`);
            }
            const data = await response.json();
            return data.data;
        } catch (error) {
            console.error(error);
            return []; // Return an empty array on error
        }
    });

    // Execute fetch requests in parallel and gather results
    const setDataArrays = await Promise.all(fetchPromises);

    // Flatten the array of arrays into a single array
    const allSetData = setDataArrays.flat();
    cardsData = cardsData.concat(allSetData);

    // Update the progress bar and UI
    loadingBar.style.width = '0%';
    loadingContext.innerText = 'Fetched All Sets!';

    setTimeout(() => {
        loadingContext.innerText = 'Displaying Cards...';
    }, 2000);

    populateFilters();
    filteredCards = csvData;
    await createDisplayCardsData();
    displayCards();
}

async function createDisplayCardsData() {
    displayCardsData = []; // Clear previous data
    for (const { name, set, rarity, artist, category, type, holo, count } of filteredCards) {
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
            displayCardsData.push({ ...card, releaseDate, price, type, holo, count });
        } else {
            console.error(`Card not found: ${name}`);
        }
    }
}

// Fill the card container
function displayCards() {
    loadingBar.style.display = 'none';
    loadingContext.style.display = 'none';

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
    const isVisible = document.querySelector('#visibleButton i').classList.contains('fa-eye');

    cardDiv.innerHTML = `
        <img src="${card.images.small}" alt="${card.name}" title="${card.name}" onclick="showPopup('${card.images.large}', '${card.name.replace(/'/g, '’')}')" style="cursor: zoom-in">
        <div class="cardInfo" style="display: ${isVisible ? 'block' : 'none'};">
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
        </div>
    `;
    cardContainer.appendChild(cardDiv);
}

function getPrice(card) {
    const priceAttributes = ['unlimited', '1stEdition', 'unlimitedHolofoil', '1stEditionHolofoil', 'normal', 'holofoil', 'reverseHolofoil'];
    for (const attr of priceAttributes) {
        const price = card.tcgplayer?.prices?.[attr]?.market || card.tcgplayer?.prices?.[attr]?.mid;
        if (price !== undefined) return price;
    }
    return undefined;
}

function showPopup(image, name) {
    const popup = document.getElementById('popup');
    const popupImage = document.getElementById('popupImage');

    popup.style.display = "block";
    popupImage.src = image;
    document.body.style.overflow = "hidden";

    const close = document.getElementsByClassName('close')[1];
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
    document.getElementById('type-filter').disabled = true;
    document.getElementById('artist-filter').disabled = true;
    document.getElementById('holo-filter').disabled = true;
    document.getElementById('sort-by').disabled = true;
    document.getElementById('order-toggle').disabled = true;
}

// Function to enable filter inputs
function enableFilters() {
    document.getElementById('rarity-filter').disabled = false;
    document.getElementById('set-filter').disabled = false;
    document.getElementById('type-filter').disabled = false;
    document.getElementById('artist-filter').disabled = false;
    document.getElementById('holo-filter').disabled = false;
    document.getElementById('sort-by').disabled = false;
    document.getElementById('order-toggle').disabled = false;
}

function populateFilters() {
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
    const types = [...new Set(csvData.map(card => card.type).filter(type => type && type !== "N/A"))].sort();
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

    // Populate type filter
    types.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        typeFilter.appendChild(option);
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
document.getElementById('type-filter').addEventListener('change', applyFilters);
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
    const typeFilter = document.getElementById('type-filter').value;
    const artistFilter = document.getElementById('artist-filter').value;
    const holoFilter = document.getElementById('holo-filter').value;
    const countFilter = document.getElementById('count-filter').value;

    filteredCards = csvData.filter(card => {
        return (!rarityFilter || card.rarity === rarityFilter) &&
               (!setFilter || card.set === setFilter) &&
               (!typeFilter || card.type === typeFilter) &&
               (!artistFilter || card.artist === artistFilter) &&
               (!holoFilter || card.holo === holoFilter) &&
               (!countFilter || card.count == countFilter);
    });

    // Filter displayCardsData directly without fetching new data
    displayCardsData = filteredCards.map(({ name, set, rarity, artist, type, holo, count }) => {
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
            return { ...card, releaseDate, price, type, holo, count };
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

const sortBySelect = document.getElementById('sort-by');
const orderToggleBtn = document.getElementById('order-toggle');
let currentIcon = 'fa-arrow-down-short-wide';

function updateIcon() {
    const selectedValue = sortBySelect.value;
    const iconElement = orderToggleBtn.querySelector('i');

    if (selectedValue === 'name' || selectedValue === 'artist') {
        if (currentIcon === 'fa-arrow-down-short-wide' || currentIcon === 'fa-arrow-down-1-9') {
            currentIcon = 'fa-arrow-down-a-z';
        } else if (currentIcon === 'fa-arrow-up-short-wide' || currentIcon === 'fa-arrow-up-1-9') {
            currentIcon = 'fa-arrow-up-a-z';
        }
    } else {
        if (currentIcon === 'fa-arrow-down-a-z' || currentIcon === 'fa-arrow-down-1-9') {
            currentIcon = 'fa-arrow-down-short-wide';
        } else if (currentIcon === 'fa-arrow-up-a-z' || currentIcon === 'fa-arrow-up-1-9') {
            currentIcon = 'fa-arrow-up-short-wide';
        }
    } 

    iconElement.className = `fa-solid ${currentIcon}`;
}

orderToggleBtn.addEventListener('click', () => {
    if (currentIcon.includes('down')) {
        currentIcon = currentIcon.replace('down', 'up');
    } else {
        currentIcon = currentIcon.replace('up', 'down');
    }
    updateIcon();
});

sortBySelect.addEventListener('change', updateIcon);

document.getElementById('visibleButton').addEventListener('click', function() {
    const cardInfos = document.querySelectorAll('.cardInfo');
    const icon = this.querySelector('i');
    const isVisible = icon.classList.contains('fa-eye');

    cardInfos.forEach(cardInfo => {
        cardInfo.style.display = isVisible ? 'none' : 'block';
    });

    if (isVisible) {
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
});

// Stats Button Event Listener
document.getElementById('statsButton').addEventListener('click', showStats);

// Modal Close Event Listener
document.querySelector('#statsModal .close').addEventListener('click', () => {
    document.getElementById('statsModal').style.display = 'none';
    document.body.style.overflow = "auto";
});

window.addEventListener('click', event => {
    if (event.target == document.getElementById('statsModal')) {
        document.getElementById('statsModal').style.display = 'none';
        document.body.style.overflow = "auto";
    }
});

let charts = {}; // Keep track of chart instances

function showStats() {
    const stats = calculateStats(displayCardsData);
    const statsContent = document.getElementById('statsContent');
    document.body.style.overflow = "hidden";

    statsContent.innerHTML = `
        <p><b>Total number of cards:</b> ${stats.totalCards}</p>
        <p><b>Earliest release date:</b> ${stats.earliestDate}</p>
        <p><b>Latest release date:</b> ${stats.latestDate}</p>
        <p><b>Cheapest card price:</b> $${stats.cheapest}</p>
        <p><b>Most expensive card price:</b> $${stats.mostExpensive}</p>
    `;

    document.getElementById('statsModal').style.display = 'block';

    updateChart('setChart', 'Number of cards by set', stats.setCounts);
    updateChart('rarityChart', 'Number of cards by rarity', stats.rarityCounts);
    updateChart('typeChart', 'Number of cards by type', stats.typeCounts);
    updateChart('supertypeChart', 'Number of cards by supertype', stats.supertypeCounts);
    updateChart('foilChart', 'Number of cards by foil', stats.foilCounts);
    updateChart('illustratorChart', 'Top 10 illustrators', Object.fromEntries(stats.topIllustrators.map(({ name, count }) => [name, count])));
}

function calculateStats(cards) {
    const setCounts = {};
    const rarityCounts = {};
    const typeCounts = {};
    const illustratorCounts = {};
    const supertypeCounts = {};
    const foilCounts = {};
    let earliestDate = null;
    let latestDate = null;
    let mostExpensive = -Infinity;
    let cheapest = Infinity;
    let totalCards = 0;

    cards.forEach(card => {
        totalCards += parseInt(card.count);

        // Count Sets
        if (card.set.name) {
            setCounts[card.set.name] = (setCounts[card.set.name] || 0) + parseInt(card.count);
        }

        // Count rarities
        if (card.rarity) {
            rarityCounts[card.rarity] = (rarityCounts[card.rarity] || 0) + parseInt(card.count);
        }

        // Count types
        if (card.type) {
            typeCounts[card.type] = (typeCounts[card.type] || 0) + parseInt(card.count);
        }

        // Count illustrators
        if (card.artist) {
            illustratorCounts[card.artist] = (illustratorCounts[card.artist] || 0) + parseInt(card.count);
        }

        // Count supertypes
        if (card.supertype) {
            supertypeCounts[card.supertype] = (supertypeCounts[card.supertype] || 0) + parseInt(card.count);
        }
        
        //Count Foils
        if (card.holo) {
            foilCounts[card.holo] = (foilCounts[card.holo] || 0) + parseInt(card.count);
        }

        // Find earliest and latest release dates
        const releaseDate = new Date(card.set.releaseDate);
        if (!earliestDate || releaseDate < earliestDate) earliestDate = releaseDate;
        if (!latestDate || releaseDate > latestDate) latestDate = releaseDate;

        // Track highest price by date
        const price = getPrice(card);
        if (price !== undefined) {
            if (price > mostExpensive) mostExpensive = price;
            if (price < cheapest) cheapest = price;
        }
    });

    const topIllustrators = Object.entries(illustratorCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));

    return {
        totalCards,
        setCounts: sortObjectByValues(setCounts),
        rarityCounts: sortObjectByValues(rarityCounts),
        typeCounts: sortObjectByValues(typeCounts),
        illustratorCounts: sortObjectByValues(illustratorCounts),
        supertypeCounts: sortObjectByValues(supertypeCounts),
        foilCounts: sortObjectByValues(foilCounts),    
        topIllustrators,
        earliestDate: earliestDate ? earliestDate.toISOString().split('T')[0] : 'N/A',
        latestDate: latestDate ? latestDate.toISOString().split('T')[0] : 'N/A',
        mostExpensive: mostExpensive === -Infinity ? 'N/A' : mostExpensive.toFixed(2),
        cheapest: cheapest === Infinity ? 'N/A' : cheapest.toFixed(2),
    };
}

function sortObjectByValues(obj) {
    return Object.fromEntries(Object.entries(obj).sort(([, a], [, b]) => b - a));
}

function updateChart(canvasId, title, data, type = 'bar') {
    if (charts[canvasId]) {
        charts[canvasId].destroy(); // Destroy existing chart instance
    }

    const ctx = document.getElementById(canvasId).getContext('2d');
    charts[canvasId] = new Chart(ctx, {
        type: type,
        data: {
            labels: Object.keys(data),
            datasets: [{
                label: title,
                data: Object.values(data),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Allow custom sizing
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
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