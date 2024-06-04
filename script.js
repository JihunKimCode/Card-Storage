// script.js

// Function to fetch data from CSV
async function fetchCSV(url) {
    const response = await fetch(url);
    const data = await response.text();
    return data;
}

// Define a cache object to store fetched image URLs
const imageCache = {};

// Function to fetch image from Pokemon TCG API or retrieve from cache
async function fetchPokemonImage(name, set, rarity) {
    // Replace spaces with periods in the set name
    name = name.replace(/ /g, '.');
    set = set.replace(/ /g, '.');

    // Check if the image URL is already cached
    const cacheKey = `${name}-${set}-${rarity}`;
    if (imageCache[cacheKey]) {
        return imageCache[cacheKey];
    }

    // Try searching with all parameters
    let url = `https://api.pokemontcg.io/v2/cards?q=name:${name} set.name:${set} rarity:${rarity}`;
    let response = await fetch(url);
    let data = await response.json();

    // If no results found, try searching without rarity
    if (!data.data || data.data.length === 0) {
        url = `https://api.pokemontcg.io/v2/cards?q=name:${name} set.name:${set}`;
        response = await fetch(url);
        data = await response.json();
    }

    // If still no results found, try searching without set name
    if (!data.data || data.data.length === 0) {
        url = `https://api.pokemontcg.io/v2/cards?q=name:${name}`;
        response = await fetch(url);
        data = await response.json();
    }

    // If data found, cache the fetched image URL
    if (data.data && data.data.length > 0) {
        const imageUrl = data.data[0].images.small;
        // Cache the fetched image URL
        imageCache[cacheKey] = imageUrl;
        return imageUrl;
    } else {
        return null;
    }
}

// Function to parse CSV data and display Pokemon cards
async function displayPokemonCards() {
    const csvData = await fetchCSV('https://raw.githubusercontent.com/JihunKimCode/Card-Storage/main/pokemon_cards.csv');
    const rows = csvData.split('\n').slice(1); // Skip header row

    const cardContainer = document.getElementById('cardContainer');

    for (const row of rows) {
        const [name, set, rarity] = row.split(',');
        const imageUrl = await fetchPokemonImage(name, set, rarity.trim());

        if (imageUrl) {
            const cardElement = document.createElement('div');
            cardElement.classList.add('card');

            const imgElement = document.createElement('img');
            imgElement.src = imageUrl;
            imgElement.alt = name;

            cardElement.appendChild(imgElement);
            cardContainer.appendChild(cardElement);
        }
    }
}

// Show popup image when image was clicked
function showPopup(image, name) {
    const popup = document.getElementById('popup');
    const popupImage = document.getElementById('popupImage');

    popup.style.display = "block";
    popupImage.src = image;
    document.body.style.overflow = "hidden";

    const close = document.getElementsByClassName('close')[0];
    close.onclick = function() {
        popup.style.display = "none";
        document.body.style.overflow = "auto";
    };

    window.onclick = function(event) {
        if (event.target == popup) {
            popup.style.display = "none";
            document.body.style.overflow = "auto";
        }
    };
}

// Scroll to top button logic
function scrollFunction() {
    const scrollTopBtn = document.getElementById("scrollTopBtn");
    if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
        scrollTopBtn.style.display = "block";
    } else {
        scrollTopBtn.style.display = "none";
    }
}

// When the user clicks on the button, scroll to the top of the document
function topFunction() {
    document.body.scrollTop = 0; // For Safari
    document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
}

// Call scrollFunction() when the window is scrolled
window.onscroll = function() {
    scrollFunction();
};

// Call function to display Pokemon cards when the page loads
displayPokemonCards();
