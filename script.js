const cardContainer = document.getElementById('card-container');
const cardPopup = document.getElementById('card-popup');
const popupContent = document.getElementById('popup-content');
const scrollTopButton = document.getElementById('scroll-top');
const loadingBar = document.getElementById('loading-bar');
const loadingPercentage = document.getElementById('loading-percentage');

const csvUrl = 'https://raw.githubusercontent.com/JihunKimCode/Card-Storage/main/pokemon_cards.csv';
const apiUrl = 'https://api.pokemontcg.io/v2/';

let cardsData = [];
let filteredCards = [];
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

async function fetchCSVData(url) {
  const response = await fetch(url);
  const data = await response.text();
  return data.split('\n').slice(1).map(line => {
    const [name, set, rarity, category, detail, holo, count] = line.split(',');
    return { name, set, rarity, category, detail, holo, count };
  });
}

async function fetchSetData(setName) {
  const formattedSetName = setName.replace(/\s/g, '.');
  const response = await fetch(`${apiUrl}cards?q=set.name:${formattedSetName}`);
  const data = await response.json();
  cardsData = cardsData.concat(data.data);
}

async function fetchCardData(name, set, rarity) {
  const formattedName = name.replace(/\s/g, '.');
  let data;

  try {
      // Search with q=name first
      let response = await fetch(`${apiUrl}cards?q=name:${formattedName}`);
      data = await response.json();

      if (data.data.length === 0) {
          return null;
      }

      // If there is more than one result, filter by set
      if (data.data.length > 1) {
          const matchedSetCards = data.data.filter(card => card.set.name.includes(set));

          // If there is still more than one result, filter by rarity
          if (matchedSetCards.length >= 1 && rarity !== "N/A" && rarity !== undefined) {
              const matchedRarityCards = matchedSetCards.filter(card => card.rarity === rarity);

              if (matchedRarityCards.length === 1) {
                  return matchedRarityCards[0];
              } else {
                  return matchedRarityCards.length > 0 ? matchedRarityCards[0] : null;
              }
          } else if (matchedSetCards.length === 0 && rarity !== "N/A" && rarity !== undefined) {
              // If no matched set, find matched rarity
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

async function fetchAllSets(csvData) {
  const sets = [...new Set(csvData.map(card => card.set))];
  const totalSets = sets.length;
  let loadedSets = 0;

  for (let set of sets) {
      if (set !== "N/A" && set !== undefined) {
          await fetchSetData(set);
      }

      // Update the loading bar
      loadedSets++;
      const progress = (loadedSets / totalSets) * 100;
      loadingBar.style.width = `${progress}%`;
      loadingPercentage.innerText = `${Math.round(progress)}%`;
  }

  loadingBar.style.display = 'none';
  loadingPercentage.style.display = 'none';

  populateFilters(csvData);
  filteredCards = csvData;
  displayCards(csvData);
}

// Modify displayCards to accept csvData
function displayCards(csvData) {
  cardContainer.innerHTML = '';
  csvData.forEach(async ({ name, set, rarity }) => {
    let card = cardsData.find(c => c.name === name && c.set.name === set && c.rarity === rarity);
    if (!card && name!==undefined) {
      card = await fetchCardData(name, set, rarity);
    }
    if (card) {
      createCardElement(card);
    } else {
      console.error(`Card not found: ${name}`);
    }
  });
}

function createCardElement(card) {
  const cardDiv = document.createElement('div');
  cardDiv.className = 'card';
  cardDiv.innerHTML = `
        <img src="${card.images.small}" alt="${card.name}" title="${card.name}" onclick="showPopup('${card.images.large}', '${card.name.replace(/'/g, '’')}')" style="cursor: zoom-in">
        <img src="${card.set.images.logo}" alt="${card.set.name}" title="${card.set.name}" style="width: 100px; cursor: default">
        <p><b>${card.name}</b></p>
        <p>${card.set.releaseDate || 'N/A'}</p>
        <p>${card.rarity || 'N/A'}</p>
        <p>
            ${card.tcgplayer && card.tcgplayer.url 
            ? `<a href="${card.tcgplayer.url}" target="_blank">Avg $${getPrice(card) || 'N/A'}</a>` 
            : `Avg $${getPrice(card) || 'N/A'}`}
        </p>
        `;
  cardContainer.appendChild(cardDiv);
}

// Get price of the card
function getPrice(card) {
    const priceAttributes = ['unlimited', '1stEdition', 'unlimitedHolofoil', '1stEditionHolofoil', 'normal', 'holofoil', 'reverseHolofoil'];
    for (const attr of priceAttributes) {
        const price = card.tcgplayer?.prices?.[attr]?.mid;
        if (price !== undefined) {
            return price;
        }
    }
    return undefined;
}

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

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.onscroll = function() {
  if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
    scrollTopButton.style.display = 'block';
  } else {
    scrollTopButton.style.display = 'none';
  }
};

// Modify populateFilters to accept csvData
function populateFilters(csvData) {
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
}

// Modify sortAndDisplayCards to use csvData
function sortAndDisplayCards() {
  const sortBy = document.getElementById('sort-by').value;

  filteredCards.sort((a, b) => {
      let compare = 0;
      if (sortBy === 'name') {
          compare = a.name.localeCompare(b.name);
      } else if (sortBy === 'rarity') {
          // Handle undefined rarity by pushing them to the end
          if (!a.rarity && !b.rarity) return 0;
          if (!a.rarity) return 1;
          if (!b.rarity) return -1;
          compare = a.rarity.localeCompare(b.rarity);
      } else if (sortBy === 'releaseDate') {
          compare = (a.set.releaseDate || '') - (b.set.releaseDate || '');
      } else if (sortBy === 'price') {
          compare = (getPrice(b) || 0) - (getPrice(a) || 0); // Sort in descending order
      }
      return compare * sortOrder;
  });

  displayCards(filteredCards);
}

// Modify fetchAllSets to pass csvData to applyFilters
async function fetchAllSets(csvData) {
  const sets = [...new Set(csvData.map(card => card.set))];
  const totalSets = sets.length;
  let loadedSets = 0;

  for (let set of sets) {
    if (set !== "N/A" && set !== undefined) {
      await fetchSetData(set);
    }

    // Update the loading bar
    loadedSets++;
    const progress = (loadedSets / totalSets) * 100;
    loadingBar.style.width = `${progress}%`;
    loadingPercentage.innerText = `${Math.round(progress)}%`;
  }

  loadingBar.style.display = 'none';
  loadingPercentage.style.display = 'none';

  // Pass csvData to populateFilters
  populateFilters(csvData);
  filteredCards = csvData;
  displayCards(csvData);
}

// Modify applyFilters to accept csvData as a parameter
function applyFilters(csvData) {
  const rarityFilter = document.getElementById('rarity-filter').value;
  const setFilter = document.getElementById('set-filter').value;
  const detailFilter = document.getElementById('detail-filter').value;

  filteredCards = csvData.filter(card => {
      return (!rarityFilter || card.rarity === rarityFilter) &&
          (!setFilter || card.set === setFilter) &&
          (!detailFilter || card.detail === detailFilter);
  });

  sortAndDisplayCards();
}

// Pass csvData to applyFilters
document.getElementById('rarity-filter').addEventListener('change', () => applyFilters(csvData));
document.getElementById('set-filter').addEventListener('change', () => applyFilters(csvData));
document.getElementById('detail-filter').addEventListener('change', () => applyFilters(filteredCards));

document.getElementById('sort-by').addEventListener('change', sortAndDisplayCards);
document.getElementById('order-toggle').addEventListener('click', () => {
  sortOrder *= -1;
  sortAndDisplayCards();
});

fetchCSVData(csvUrl).then(fetchAllSets);
