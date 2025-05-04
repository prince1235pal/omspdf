# omPDF Converter Pro

A modern, user-friendly web application for converting Word documents and images to high-quality PDFs. This tool supports batch file uploads, drag-and-drop functionality, and maintains the original formatting of Word files while offering customizable options for PDF conversion.

## Features

- Convert Word documents (.doc, .docx) to PDF
- Convert images (.jpg, .jpeg, .png, .bmp, .webp) to PDF
- Batch file processing
- Drag-and-drop interface
- Customizable options (page size, orientation, margins)
- File preview before download
- Automatic cleanup of temporary files

## Prerequisites

- Node.js (v14 or higher)
- LibreOffice (required for Word to PDF conversion)

### Installing LibreOffice

#### Windows
1. Download LibreOffice from [https://www.libreoffice.org/download](https://www.libreoffice.org/download)
2. Run the installer and follow the installation instructions
3. Make sure the path in `server.js` matches your installation path:
   ```javascript
   const libreOfficePath = process.platform === 'win32' 
       ? '"C:\\Program Files\\LibreOffice\\program\\soffice.exe"' 
       : 'soffice';
   ```

#### macOS
1. Install using Homebrew:
   ```
   brew install --cask libreoffice
   ```
   
#### Linux (Ubuntu/Debian)
1. Install using apt:
   ```
   sudo apt update
   sudo apt install libreoffice
   ```

## Installation

1. Clone this repository or download the code
2. Navigate to the project directory
3. Install dependencies:

```bash
npm install
```

## Running the Application

### Development Mode

```bash
npm run dev
```

This will start the server with nodemon, which automatically restarts when code changes are detected.

### Production Mode

```bash
npm start
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## Project Structure

```
omPDF-converter-pro/
├── css/
│   └── styles.css
├── js/
│   └── app.js
├── uploads/          # Temporary storage for uploaded files
├── output/           # Generated PDFs are stored here
├── index.html        # Main HTML file
├── server.js         # Express server and conversion logic
├── package.json
└── README.md
```

## How It Works

1. **Word to PDF Conversion**: Uses LibreOffice to convert Word documents to PDF, preserving the original formatting.
2. **Image to PDF Conversion**: Uses pdf-lib and sharp libraries to convert images to PDF with customizable options.
3. **File Handling**: Temporary files are stored in the uploads directory, converted PDFs are stored in the output directory, and both are automatically cleaned up after one hour.

## Customizing

### Frontend

The frontend is built with vanilla HTML, CSS, and JavaScript. You can easily customize the user interface by modifying:

- `index.html` - Main structure
- `css/styles.css` - Styling
- `js/app.js` - Interactive features

### Backend

The backend is built with Node.js and Express. The main conversion logic is in `server.js`.

## Security Considerations

- The application automatically deletes uploaded files and generated PDFs after one hour
- File size and type validations are implemented
- Cross-Origin Resource Sharing (CORS) is enabled in the backend

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [pdf-lib](https://github.com/Hopding/pdf-lib) - For PDF generation
- [sharp](https://sharp.pixelplumbing.com/) - For image processing
- [Express](https://expressjs.com/) - For the web server
- [Multer](https://github.com/expressjs/multer) - For file uploads
- [LibreOffice](https://www.libreoffice.org/) - For Word to PDF conversion

## Testing

For testing the omPDF Converter Pro, you can use the following scripts:

1. Test server status: `node test-status.js`
2. Test text-to-PDF conversion: `node test-text-to-pdf.js`
3. Test image-to-PDF conversion: `node test-image-to-pdf.js`

### Debug Endpoints

For development and debugging, the following endpoints are available:

- `GET /api/debug/status` - Returns the current server status and configuration
- `GET /api/debug/create-test-file` - Creates a sample PDF file for testing
- `POST /api/debug/convert-text` - Converts plain text to PDF

## Recent Improvements

- Added SVG support for image-to-PDF conversion
- Improved error handling and logging
- Added diagnostic endpoints for troubleshooting
- Fixed file path handling and URL encoding
- Added proper validation for uploaded files
- Implemented fallback PDF generation when LibreOffice isn't available
- Added test scripts for verifying functionality

## Advanced PDF Manipulation

The application now supports advanced PDF manipulation features:

### PDF Merging

Combine multiple PDF files into a single document:

```
POST /api/merge-pdfs
```

Upload multiple PDF files using the `files` field in a multipart form.

### PDF Splitting

Extract specific pages from a PDF document:

```
POST /api/split-pdf
```

Upload a PDF file using the `file` field and specify the pages to extract using the `pageRanges` field (e.g., "1,3,5-7").

### PDF Watermarking

Add text watermarks to PDF documents:

```
POST /api/add-watermark
```

Upload a PDF file using the `file` field and customize the watermark with these options:
- `text`: Watermark text (default: "CONFIDENTIAL")
- `color`: Hex color code (default: "#FF0000")
- `opacity`: Transparency level from 0 to 1 (default: 0.3)
- `fontSize`: Size of the watermark text (default: 50)
- `diagonal`: Whether to display diagonally (default: false)
- `repeat`: Whether to repeat across the page (default: false)

### PDF Password Protection

Secure PDF documents with password protection:

```
POST /api/protect-pdf
```

Upload a PDF file using the `file` field and set security options:
- `userPassword`: Password required to open the document
- `ownerPassword`: Password for full permissions (defaults to userPassword)
- `allowPrinting`: Allow printing the document (default: false)
- `allowModifying`: Allow modifying the document (default: false)
- `allowCopying`: Allow copying content from the document (default: false)
- `allowAnnotating`: Allow adding annotations (default: false)
- `allowFillingForms`: Allow filling form fields (default: true)
- `allowAccessibility`: Allow extracting content for accessibility (default: true)
- `allowAssembly`: Allow assembling the document (default: false)

## Next Steps

- Add support for more input formats (e.g., PowerPoint, Excel, HTML)
- Implement advanced PDF compression options
- Add OCR for scanned documents
- Improve batch processing capabilities
- Enhance the frontend with progress indicators and more detailed feedback 