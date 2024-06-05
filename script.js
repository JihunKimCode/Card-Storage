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
    <img src="${card.images.small}" alt="${card.name}" onclick="showPopup('${card.images.large}')">
    <p>${card.name}</p>
    <p>Set: ${card.set.name}</p>
    <p>Release Date: ${card.set.releaseDate}</p>
    <p>Price: $${card.cardmarket ? card.cardmarket.prices.averageSellPrice : 'N/A'}</p>
  `;
  cardContainer.appendChild(cardDiv);
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
