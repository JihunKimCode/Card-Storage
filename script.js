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

// Take CSV data
async function fetchCSVData(url) {
    const response = await fetch(url);
    const data = await response.text();
    return data.split('\n').slice(1).map(line => {
        const [name, set, rarity, category, detail, holo, count] = line.split(',');
        return { name, set, rarity, category, detail, holo, count };
    });
}

// Fetch to each sets
async function fetchSetData(setName) {
    const formattedSetName = setName.replace(/\s/g, '.');
    const response = await fetch(`${apiUrl}cards?q=set.name:${formattedSetName}`);
    const data = await response.json();
    cardsData = cardsData.concat(data.data);
}

// search with name and then set and rarity
async function fetchCardData(name, set, rarity) {
    const formattedName = name.replace(/\s/g, '.');
    let data;

    try {
        let response = await fetch(`${apiUrl}cards?q=name:${formattedName}`);
        data = await response.json();

        if (data.data.length === 0) {
            return null;
        }

        if (data.data.length > 1) {
            const matchedSetCards = data.data.filter(card => card.set.name.includes(set));

            if (matchedSetCards.length >= 1 && rarity !== "N/A" && rarity !== undefined) {
                const matchedRarityCards = matchedSetCards.filter(card => card.rarity === rarity);

                if (matchedRarityCards.length === 1) {
                    return matchedRarityCards[0];
                } else {
                    return matchedRarityCards.length > 0 ? matchedRarityCards[0] : null;
                }
            } else if (matchedSetCards.length === 0 && rarity !== "N/A" && rarity !== undefined) {
                const matchedRarityCards = data.data.filter(card => card.rarity === rarity);

                if (matchedRarityCards.length === 1) {
                    return matchedRarityCards[0];
                } else {
                    return matchedRarityCards.length > 0 ? matchedRarityCards[0] : await deeperFetchCardData(name, rarity);
                }
            } else {
                return matchedSetCards.length > 0 ? matchedSetCards[0] : await deeperFetchCardData(name, rarity);
            }
        } else {
            return data.data[0];
        }
    } catch (error) {
        console.error('Error fetching card data:', error);
        return null;
    }
}

//search only with name and rarity
async function deeperFetchCardData(name, rarity) {
    const formattedName = name.replace(/\s/g, '.');
    if (rarity == "N/A" || rarity == undefined) {
        let response = await fetch(`${apiUrl}cards?q=name:${formattedName}`);
        let data = await response.json();
        return data.data[0];
    }
    try {
        const formattedRarity = rarity.replace(/\s/g, '.');
        let response = await fetch(`${apiUrl}cards?q=name:${formattedName} rarity:${formattedRarity}`);
        if (!response.ok) {
            throw new Error('Bad Request');
        }
        let data = await response.json();
        if (data.data.length === 0) {
            response = await fetch(`${apiUrl}cards?q=name:${formattedName}`);
            data = await response.json();
        }
        return data.data[0];
    } catch (error) {
        try {
            let response = await fetch(`${apiUrl}cards?q=name:${formattedName}`);
            let data = await response.json();
            return data.data[0];
        } catch (finalError) {
            console.error('Error fetching card data:', finalError);
            return null;
        }
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
    for (const { name, set, rarity } of filteredCards) {
        if (!name) {
            console.error('Card name is blank or undefined');
            continue; // Skip this card
        }

        let card = cardsData.find(c => c.name === name && c.set.name === set && c.rarity === rarity);
        if (!card) {
            card = await fetchCardData(name, set, rarity);
        }
        if (card) {
            // Store additional information
            const releaseDate = card.set.releaseDate || '';
            const price = getPrice(card) || 0;
            displayCardsData.push({ ...card, releaseDate, price });
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
    cardDiv.innerHTML = `
        <img src="${card.images.small}" alt="${card.name}" title="${card.name}" onclick="showPopup('${card.images.large}', '${card.name.replace(/'/g, '’')}')" style="cursor: zoom-in">
        <img src="${card.set.images.logo}" alt="${card.set.name}" title="${card.set.name}" style="width: 100px; cursor: default">
        <p><b>${card.name}</b></p>
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
    document.getElementById('sort-by').disabled = true;
    document.getElementById('order-toggle').disabled = true;
}

// Function to enable filter inputs
function enableFilters() {
    document.getElementById('rarity-filter').disabled = false;
    document.getElementById('set-filter').disabled = false;
    document.getElementById('detail-filter').disabled = false;
    document.getElementById('sort-by').disabled = false;
    document.getElementById('order-toggle').disabled = false;
}

function populateFilters() {
    const rarityFilter = document.getElementById('rarity-filter');
    const setFilter = document.getElementById('set-filter');
    const detailFilter = document.getElementById('detail-filter');

    const rarities = [...new Set(csvData.map(card => card.rarity).filter(rarity => rarity && rarity !== "N/A"))];
    rarities.forEach(rarity => {
        const option = document.createElement('option');
        option.value = rarity;
        option.textContent = rarity;
        rarityFilter.appendChild(option);
    });

    const sets = [...new Set(csvData.map(card => card.set).filter(set => set && set !== "N/A"))];
    sets.forEach(set => {
        const option = document.createElement('option');
        option.value = set;
        option.textContent = set;
        setFilter.appendChild(option);
    });

    const details = [...new Set(csvData.map(card => card.detail).filter(detail => detail && detail !== "N/A"))];
    details.forEach(detail => {
        const option = document.createElement('option');
        option.value = detail;
        option.textContent = detail;
        detailFilter.appendChild(option);
    });

    document.getElementById('rarity-filter').addEventListener('change', applyFilters);
    document.getElementById('set-filter').addEventListener('change', applyFilters);
    document.getElementById('detail-filter').addEventListener('change', applyFilters);
}

document.getElementById('rarity-filter').addEventListener('change', applyFilters);
document.getElementById('set-filter').addEventListener('change', applyFilters);
document.getElementById('detail-filter').addEventListener('change', applyFilters);
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

    filteredCards = csvData.filter(card => {
        return (!rarityFilter || card.rarity === rarityFilter) &&
               (!setFilter || card.set === setFilter) &&
               (!detailFilter || card.detail === detailFilter);
    });

    await createDisplayCardsData(); // Ensure this is complete before enabling filters
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
            compare = b.price - a.price; // Sort in descending order
        }
        return compare * sortOrder;
    });

    displayCards();
    enableFilters(); // Re-enable filters after sorting
}

// Main
fetchCSVData(csvUrl).then(data => {
    csvData = data;
    fetchAllSets();
});

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
    "Rare Holo VSTAR": 6,
    "Rare Holo VMAX": 6,
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