// ==========================
// Global Variables & DOM References
// ==========================
let companyTickersData = null;
const stockForm = document.getElementById('stockForm');
const tickerInput = document.getElementById('tickerInput');

const loadingMessage = document.getElementById('loadingMessage');
const errorMessage = document.getElementById('errorMessage');

const historicalDataDiv = document.getElementById('historicalData');
const secLinksDiv = document.getElementById('secLinks');

// ==========================
// Show/Hide Utility Functions
// ==========================
function showLoading(show) {
  if (loadingMessage) loadingMessage.style.display = show ? 'block' : 'none';
}

function showError(msg) {
  if (errorMessage) {
    errorMessage.textContent = msg;
    errorMessage.style.display = 'block';
  }
}

function hideError() {
  if (errorMessage) errorMessage.style.display = 'none';
}

// ==========================
// Load company_tickers.json from local file
// ==========================
async function loadCompanyTickers() {
  const url = "./company_tickers.json"; // LOCAL file
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to load local company_tickers.json (status ${resp.status})`);
  }
  const rawJson = await resp.json();
  companyTickersData = Object.values(rawJson);
  console.log("Loaded", companyTickersData.length, "tickers locally.");
}

// ==========================
// Convert Ticker -> CIK
// ==========================
function findCIK(ticker) {
  if (!companyTickersData) {
    throw new Error("company_tickers.json is not loaded yet.");
  }

  const match = companyTickersData.find(obj => obj.ticker === ticker.toUpperCase());
  if (!match) {
    throw new Error(`Ticker '${ticker}' not found.`);
  }

  return String(match.cik_str).padStart(10, '0');
}

// ==========================
// Fetch Recent Filings by CIK
// ==========================
async function getRecentFilings(cik) {
    const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Failed to fetch filings for CIK ${cik}`);
    }
  
    const data = await resp.json();
    const { form, filingDate, accessionNumber, primaryDocument } = data.filings.recent;
  
    const filings = form.map((f, i) => ({
      form: f,
      date: filingDate[i],
      accessionNumber: accessionNumber[i],
      doc: primaryDocument[i]
    }));
  
    const formTypes = ["10-K", "10-Q", "8-K"];
    let selected = [];
  
    for (const type of formTypes) {
      const subset = filings
        .filter(f => f.form === type)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5);
      selected = selected.concat(subset);
    }
  
    return selected;
  }

// ==========================
// Display Filings in Table
// ==========================
function displayFilings(filings, cik) {
  secLinksDiv.innerHTML = "";

  if (!filings.length) {
    secLinksDiv.innerHTML = "<p>No recent filings found.</p>";
    return;
  }

  const rows = filings.map(f => {
    const cleanAccession = f.accessionNumber.replace(/-/g, '');
    const link = `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${cleanAccession}/${f.doc}`;
    return `<tr>
      <td>${f.form}</td>
      <td>${f.date}</td>
      <td><a href="${link}" target="_blank">View</a></td>
    </tr>`;
  }).join('');

  secLinksDiv.innerHTML = `
    <table class="table table-striped">
      <thead><tr><th>Form</th><th>Date</th><th>Link</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ==========================
// Update TradingView Chart
// ==========================
function updateTradingViewChart(symbol) {
  const container = document.getElementById('tv_chart');
  if (!container) return;

  container.innerHTML = ''; // Clear existing chart

  new TradingView.widget({
    "container_id": "tv_chart",
    "width": "100%",
    "height": 500,
    "symbol": symbol,
    "interval": "D",
    "timezone": "Etc/UTC",
    "theme": "light",
    "style": "1",
    "locale": "en",
    "toolbar_bg": "#f1f3f6",
    "enable_publishing": false,
    "allow_symbol_change": true,
    "hide_side_toolbar": false,
  });
}

// ==========================
// Handle Form Submit
// ==========================
async function handleFormSubmit(event) {
  event.preventDefault();
  hideError();
  showLoading(true);

  const ticker = tickerInput.value.trim().toUpperCase();

  if (!ticker) {
    showLoading(false);
    showError("Please enter a ticker.");
    return;
  }

  try {
    const cik = findCIK(ticker);
    updateTradingViewChart(ticker);
    const filings = await getRecentFilings(cik);
    displayFilings(filings, cik);
  } catch (err) {
    showError(err.message);
  } finally {
    showLoading(false);
  }
}

// ==========================
// Initialize App
// ==========================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    showLoading(true);
    await loadCompanyTickers();
  } catch (err) {
    showError("Failed to load local ticker data.");
    console.error(err);
  } finally {
    showLoading(false);
  }

  stockForm.addEventListener('submit', handleFormSubmit);
});
