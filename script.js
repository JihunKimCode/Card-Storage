const cardContainer = document.getElementById('card-container');
const cardPopup = document.getElementById('card-popup');
const popupContent = document.getElementById('popup-content');
const scrollTopButton = document.getElementById('scroll-top');

const csvUrl = 'https://raw.githubusercontent.com/JihunKimCode/Card-Storage/main/pokemon_cards.csv';
const apiUrl = 'https://api.pokemontcg.io/v2/';

let cardsData = [];

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

async function fetchCardData(name, rarity) {
    const formattedName = name.replace(/\s/g, '.');
    if(rarity == "N/A" || rarity == undefined){
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
  for (let set of sets) {
    if (set !== "N/A" && set !== undefined) {
      await fetchSetData(set);
    }
  }
  displayCards(csvData);
}

function displayCards(csvData) {
  csvData.forEach(async ({ name, set, rarity }) => {
    let card = cardsData.find(c => c.name === name && c.set.name === set && c.rarity === rarity);
    if (!card && name!==undefined) {
      card = await fetchCardData(name, rarity);
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

fetchCSVData(csvUrl).then(fetchAllSets);
