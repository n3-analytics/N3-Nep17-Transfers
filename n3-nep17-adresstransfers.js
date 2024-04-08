document.addEventListener('DOMContentLoaded', function() {
	let lastTimestamp = 1;
	let seenTransactionKeys = new Set();
	const { sc, wallet, CONST } = Neon; 


    const dataStore = {};
    const nav = document.getElementById('nav');
    const searchTab = document.getElementById('n3-nep17');
    const addressInput = document.getElementById('addressInput');
    const resultsElement = document.getElementById('results');
    const loadingElement = document.getElementById('loading');
	const summaryCard = document.getElementById('summaryCard');
	const summaryContent = document.getElementById('summaryContent');
	const rawData = document.getElementById('rawData');
	const jsonData = document.getElementById('jsonData');
	const downloadCsvBtn = document.getElementById('downloadCsv');
	const downloadJsonBtn = document.getElementById('downloadJson');
	const searchBtnSvg = document.getElementById('searchBtnSvg');
    searchTab.addEventListener('click', () => {
        showSearch();
    });
	downloadCsvBtn.addEventListener('click', function() {
        if (window.location.hash) {
            const address = decodeURIComponent(window.location.hash.substring(10));
            if (dataStore[address]) {
				downloadCsv(dataStore[address]);
            }
        }
	});
	downloadJsonBtn.addEventListener('click', function() {
        if (window.location.hash) {
            const address = decodeURIComponent(window.location.hash.substring(10));
            if (dataStore[address]) {
				downloadJson(dataStore[address]);
            }
        }
	});
    searchBtn.addEventListener('click', function() {
        const address = addressInput.value.trim();
        if (!wallet.isAddress(address, CONST.DEFAULT_ADDRESS_VERSION)) {
            alert('Please enter an valid address.');
			handleHashChange();
            return;
        }

        startLoading(); // Initiate loading state

        const encodedAddress = encodeURIComponent(address);
		if (dataStore[encodedAddress]) {
			stopLoading(true);
			displayResults(dataStore[encodedAddress]);
		}
		else{
			fetchNep17(address)
				.then(data => {
					window.location.hash = `#n3-nep17#${encodedAddress}`;;
					stopLoading(true); // Indicate loading has stopped with success
					dataStore[encodedAddress] = data;
					addNavItem(address);
					displayResults(data); // Function to display the fetched results
					
				})
				.catch(error => {
					stopLoading(false); // Indicate loading has stopped with an error
					console.error('Error fetching data:', error);
				});
		}

    });
	
	function startLoading() {
			// Add pulsing effect to the input box and show loading spinner on the button
			searchBtnSvg.classList.add('animate-ping', 'opacity-75');
			addressInput.disabled = true; // Disable the input box during loading
			searchBtn.disabled = true; // Disable the button during loading
		}
	function stopLoading(success) {
        // Remove pulsing effect and loading spinner
		searchBtnSvg.classList.remove('animate-ping', 'opacity-75');
		addressInput.disabled = false; // Disable the input box during loading
		searchBtn.disabled = false;
    }
    function addNavItem(address) {
        const encodedAddress = encodeURIComponent(address);
        const navItem = document.createElement('a');
        navItem.href = `#n3-nep17#${encodedAddress}`;
        navItem.textContent = `${address.substring(0, 10)}...`;
        navItem.className = 'nav-item block py-2 px-2 rounded-lg transition duration-100 hover:bg-zinc-700';
        navItem.addEventListener('click', () => {
            if (dataStore[encodedAddress]) {
                displayResults(dataStore[encodedAddress]);
            }
        });
        nav.appendChild(navItem);
		activateTab(navItem);
    }

    function activateTab(selectedNavItem) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        selectedNavItem.classList.add('active');
    }

    function showSearch() {
        addressInput.value = ''; // Clear the input
        addressInput.focus(); // Focus on the input
		summaryCard.classList.remove("pointer-events-auto", "opacity-100");
		summaryCard.classList.add("pointer-events-none", "opacity-0");
		jsonData.classList.remove("pointer-events-auto", "opacity-100");
		jsonData.classList.add("pointer-events-none", "opacity-0");
		resetDashboard();
        activateTab(searchTab); // Set the search tab as active
    }


    // Listen to hash change to handle browser navigation
    window.addEventListener('hashchange', handleHashChange);
	
	
	
    function handleHashChange() {
        const hash = window.location.hash.replaceAll('#', '');
		
        if (hash === 'n3-nep17' || hash === '') {
            showSearch();
        } else {
			address = hash.slice(8);
			
            if (dataStore[address]) {
				
                displayResults(dataStore[address]);
                // Find and activate the corresponding nav item
                document.querySelectorAll('.nav-item').forEach(item => {
                    if (item.href.endsWith(address)) {
                        activateTab(item);
                    }
                });
            }
			else if(wallet.isAddress(address, CONST.DEFAULT_ADDRESS_VERSION)) {
				addressInput.value = address;
				searchBtn.click();
			}
        }
    }


    function displayResults(data) {
        const resultsElement = document.getElementById('results');
		summaryCard.classList.remove("pointer-events-none", "opacity-0");
		summaryCard.classList.add("pointer-events-auto", "opacity-100");
		jsonData.classList.remove("pointer-events-none", "opacity-0");
		jsonData.classList.add("pointer-events-auto", "opacity-100");
		resetDashboard();
        // Check if data is available
        if (!data || data.length === 0) {
            return;
        }
		updateDashboard(data);
    }
	
	 function activateTab(tab) {
        document.querySelectorAll('#nav a').forEach(a => a.classList.remove('active'));
        tab.classList.add('active');
    }
	
	const fetchNep17 = async (address) => {
	  const client = new Neon.rpc.RPCClient("https://mainnet1.neo.coz.io:443");
	  const method = 'getnep17transfers';
	  let hasMoreData = true;
	  let transactions = [];
	  lastTimestamp = 1;
		seenTransactionKeys = new Set();
	  while (hasMoreData) {
		const { transactions: newTransactions, newLastTimestamp } = await fetchData(client, address, method, lastTimestamp);
		if (newTransactions && newTransactions.length > 0) {
			
		  transactions.push(...newTransactions);
		  lastTimestamp = newLastTimestamp; // Update for next iteration
		}else {
		  hasMoreData = false; // No more transactions to fetch
		}
	  }
	  return transactions.map(tx => ({
		timestamp: tx.timestamp,
		assetHash: tx.assethash,
		transferAddress: tx.transferaddress,
		amount: tx.amount,
		blockIndex: tx.blockindex,
		transferNotifyIndex: tx.transfernotifyindex,
		txHash: tx.txhash
	  }));
	};

	const fetchData = async (client, address, method, lastTimestamp) => {
	  let lastBlock = await client.getBlockCount() - 1;
	  let transactions = [];
	  let nextTimestamp  = Infinity;
	  let test = client.getBlockCount();
	  const query = new Neon.rpc.Query({ method: method , params: [address, lastTimestamp] });
	  let newTransactions = {};

		let response = await client.execute(query);
		
		if (response) {
		  // Process response, extract transactions
		  newTransactions = response; 
			
			// Extract timestamps from both received and sent transactions
			  const receivedTimestamps = newTransactions.received.map(tx => tx.timestamp);
			  const sentTimestamps = newTransactions.sent.map(tx => tx.timestamp);
			  
			  // Find the latest timestamp in both arrays
			  const latestReceivedTimestamp = Math.max(...receivedTimestamps, 0);
			  const latestSentTimestamp = Math.max(...sentTimestamps, 0); 
			// Calculate nextTimestamp as the minimum of the latest timestamps + 1, unless both are 0
			  nextTimestamp = Math.min(
				latestReceivedTimestamp ? latestReceivedTimestamp + 1 : Infinity,
				latestSentTimestamp ? latestSentTimestamp + 1 : Infinity
			  );
		  // Check if new transactions were fetched
		  if (newTransactions.received.length > 0 || newTransactions.sent.length > 0) {
			  

				// Handle case where both are 0 (no transactions)
			newTransactions.received.forEach(tx => {
			  const key = `${tx.txhash}-received-${tx.transfernotifyindex}`;
			  if (!seenTransactionKeys.has(key)) {
				transactions.push(tx);
				seenTransactionKeys.add(key);
			  }
			});
			newTransactions.sent.forEach(tx => {
			  const key = `${tx.txhash}-sent-${tx.transfernotifyindex}`;
			  if (!seenTransactionKeys.has(key)) {
				 // console.log(tx);
				transactions.push(tx);
				seenTransactionKeys.add(key);
			  }
			});
		  }
		}

		
		
		return {
			transactions: transactions,
			newLastTimestamp: nextTimestamp,
		  };
	};
	function resetDashboard() {
		summaryContent.textContent = '';
		rawData.textContent = '';
	}
	function updateDashboard(data) {
		// Update summary card
		const uniqueColumns = new Set();
		data.forEach(item => {
			Object.keys(item).forEach(key => uniqueColumns.add(key));
		});
		const records = data.length;
		const columns = uniqueColumns.size;
		// Assuming each character in the JSON string is ~1 byte for simplicity
		const size = new Blob([JSON.stringify(data)]).size;
		summaryContent.textContent = `Records: ${records}, Columns: ${columns}, Size: ${size} bytes`;

		// Update raw JSON display
		rawData.textContent = JSON.stringify(data, null, 2); // Beautify JSON
	}
	const generateId = (transaction) => {
	  return `${transaction.direction}-${transaction.txHash}-${transaction.transferNotifyIndex}`;
	};
	function downloadCsv(data) {
		const csvRows = [];
		const headers = Object.keys(data[0]);
		csvRows.push(headers.join(','));

		for (const row of data) {
			const values = headers.map(header => {
				const escaped = (''+row[header]).replace(/"/g, '\\"');
				return `"${escaped}"`;
			});
			csvRows.push(values.join(','));
		}

		const csvString = csvRows.join('\n');
		const blob = new Blob([csvString], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.setAttribute('hidden', '');
		a.setAttribute('href', url);
		a.setAttribute('download', 'data.csv');
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}
	function downloadJson(data) {
		const jsonString = JSON.stringify(data);
		const blob = new Blob([jsonString], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.setAttribute('hidden', '');
		a.setAttribute('href', url);
		a.setAttribute('download', 'data.json');
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}
	handleHashChange();
});