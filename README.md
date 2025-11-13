# Marine Line Tension Monitor

## Overview
The Marine Line Tension Monitor is a web-based application designed to monitor and display tension data for mooring hooks at various berths. The application provides an interface for users to view tension levels and receive alerts for high tension cables.

## Project Structure
```
marine-line-tension-monitor
├── index.html          # Main landing page with links to berths
├── berth-one.html      # Displays data for Berth One
├── berth-two.html      # Displays data for Berth Two
├── css
│   └── styles.css      # Styles for the website
├── js
│   ├── main.js         # Main functionality and event listeners
│   └── api.js          # Fetches data from high_tension.json
├── data
│   └── high_tension.json # Data related to high tension cables
├── httpreceiver.py     # Python script for receiving HTTP requests
├── parsejson.py        # Functions to parse JSON payloads
├── hookclass.py        # Defines Hook and MooringMonitor classes
└── README.md           # Documentation for the project
```

## Setup Instructions
1. Clone the repository to your local machine.
2. Navigate to the project directory.
3. Ensure you have Python installed to run the `httpreceiver.py` script.
4. Start the HTTP server by running:
   ```
   python httpreceiver.py
   ```
5. Open `index.html` in your web browser to access the application.

## Usage
- Click on "Berth One" or "Berth Two" to view specific tension data for each berth.
- The sidebar will display information on high tension cables, fetched from the `high_tension.json` file.

## Contributing
Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.

## License
This project is licensed under the MIT License.