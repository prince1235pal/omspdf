const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const sharp = require('sharp');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Set up static file serving - IMPORTANT: Order matters for path resolution!
// Serve files from the output directory with higher priority
app.use('/output', express.static(path.join(__dirname, 'output')));
// Serve static files from the root directory
app.use(express.static(path.join(__dirname)));
// Serve from public directory if it exists
if (fs.existsSync(path.join(__dirname, 'public'))) {
    app.use(express.static(path.join(__dirname, 'public')));
}

// Log all incoming requests for debugging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} | ${req.method} ${req.url}`);
    next();
});

// Create uploads and output directories if they don't exist
const uploadsDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'output');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
    console.log(`Created uploads directory at: ${uploadsDir}`);
}

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
    console.log(`Created output directory at: ${outputDir}`);
} else {
    console.log(`Output directory exists at: ${outputDir}`);
}

// Ensure output directory is accessible to the server
try {
    // Verify we can write to the output directory by writing a test file
    const testFilePath = path.join(outputDir, '_test.txt');
    fs.writeFileSync(testFilePath, 'Test file to verify directory permissions');
    console.log('Successfully verified write access to output directory');
    // Clean up the test file
    fs.unlinkSync(testFilePath);
} catch (error) {
    console.error(`ERROR: Output directory is not writable: ${error.message}`);
}

// Configure multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        console.log(`Storing file ${file.originalname} in ${uploadsDir}`);
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueFilename = uuidv4() + path.extname(file.originalname);
        console.log(`Renaming file ${file.originalname} to ${uniqueFilename}`);
        cb(null, uniqueFilename);
    }
});

// File filter to validate allowed file types
const fileFilter = (req, file, cb) => {
    const allowedWordTypes = ['.doc', '.docx'];
    const allowedImageTypes = ['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.svg'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    console.log(`File upload attempt: ${file.originalname}, extension: ${ext}, originalUrl: ${req.originalUrl}`);
    
    // Properly check the route path
    if (req.originalUrl.includes('/api/convert-word') && allowedWordTypes.includes(ext)) {
        console.log(`Accepted Word document: ${file.originalname}`);
        cb(null, true);
    } else if (req.originalUrl.includes('/api/convert-image') && allowedImageTypes.includes(ext)) {
        console.log(`Accepted image file: ${file.originalname}`);
        cb(null, true);
    } else {
        console.log(`File rejected: ${file.originalname} (${ext}) for route ${req.originalUrl}`);
        cb(new Error(`Invalid file type: ${ext}. Allowed types for this conversion: ${req.originalUrl.includes('word') ? allowedWordTypes.join(', ') : allowedImageTypes.join(', ')}`), false);
    }
};

// Configure multer with proper error handling
const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 20 * 1024 * 1024 // 20MB max file size
    }
});
console.log('Multer initialized successfully');

// Schedule cleanup of temporary files
function cleanupTempFiles() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    // Clean uploads directory
    fs.readdir(uploadsDir, (err, files) => {
        if (err) return console.error('Error reading uploads directory:', err);
        
        files.forEach(file => {
            const filePath = path.join(uploadsDir, file);
            fs.stat(filePath, (err, stats) => {
                if (err) return console.error('Error getting file stats:', err);
                
                if (stats.mtimeMs < oneHourAgo) {
                    fs.unlink(filePath, err => {
                        if (err) console.error('Error deleting file:', err);
                    });
                }
            });
        });
    });
    
    // Clean output directory
    fs.readdir(outputDir, (err, files) => {
        if (err) return console.error('Error reading output directory:', err);
        
        files.forEach(file => {
            const filePath = path.join(outputDir, file);
            fs.stat(filePath, (err, stats) => {
                if (err) return console.error('Error getting file stats:', err);
                
                if (stats.mtimeMs < oneHourAgo) {
                    fs.unlink(filePath, err => {
                        if (err) console.error('Error deleting file:', err);
                    });
                }
            });
        });
    });
}

// Run cleanup every hour
setInterval(cleanupTempFiles, 60 * 60 * 1000);

// API endpoint for downloading PDF files
app.get('/api/download/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        console.log(`Download request for file: ${filename}`);
        
        // Sanitize filename to prevent directory traversal attacks
        const sanitizedFilename = path.basename(filename);
        const filePath = path.join(outputDir, sanitizedFilename);
        
        console.log(`Looking for file at path: ${filePath}`);
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filePath}`);
            
            // List available files in output directory for debugging
            try {
                const availableFiles = fs.readdirSync(outputDir);
                console.log(`Available files in output directory (${outputDir}):`);
                if (availableFiles.length === 0) {
                    console.log(' - No files found in output directory');
                } else {
                    availableFiles.forEach(file => console.log(` - ${file}`));
                }
            } catch (err) {
                console.error(`Error reading output directory: ${err.message}`);
            }
            
            return res.status(404).json({ 
                success: false, 
                message: 'File not found' 
            });
        }
        
        console.log(`File found, sending to client: ${filePath}`);
        
        // Set Content-Disposition header to prompt download
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(sanitizedFilename)}"`);
        res.setHeader('Content-Type', 'application/pdf');
        
        // Stream the file to the client
        const fileStream = fs.createReadStream(filePath);
        fileStream.on('error', error => {
            console.error(`Error streaming file: ${error}`);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: 'Error streaming file',
                    error: error.message
                });
            }
        });
        
        fileStream.pipe(res);
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({
            success: false,
            message: 'Error downloading file',
            error: error.message
        });
    }
});

// API endpoint for Word to PDF conversion
app.post('/api/convert-word', upload.array('files', 10), async (req, res) => {
    console.log('Starting word-to-pdf conversion...');
    try {
        if (!req.files || req.files.length === 0) {
            console.log('No files uploaded');
            return res.status(400).json({ success: false, message: 'No files uploaded' });
        }
        
        const conversionOptions = JSON.parse(req.body.options || '{}');
        const results = [];
        
        for (const file of req.files) {
            const inputPath = file.path;
            const outputFilename = path.basename(file.originalname, path.extname(file.originalname)) + '.pdf';
            const outputPath = path.join(outputDir, outputFilename);
            
            // Check if LibreOffice is available
            let libreOfficeAvailable = false;
            
            if (process.platform === 'win32') {
                try {
                    // Test if LibreOffice exists at the expected path
                    fs.accessSync("C:\\Program Files\\LibreOffice\\program\\soffice.exe", fs.constants.F_OK);
                    libreOfficeAvailable = true;
                } catch (err) {
                    console.log("LibreOffice not found, using fallback PDF generation");
                }
            } else {
                // For non-Windows systems
                try {
                    require('child_process').execSync('which soffice');
                    libreOfficeAvailable = true;
                } catch (err) {
                    console.log("LibreOffice not found, using fallback PDF generation");
                }
            }
            
            if (libreOfficeAvailable) {
                // Use LibreOffice for conversion
                const libreOfficePath = process.platform === 'win32' 
                    ? '"C:\\Program Files\\LibreOffice\\program\\soffice.exe"' 
                    : 'soffice';
                
                const cmd = `${libreOfficePath} --headless --convert-to pdf --outdir "${outputDir}" "${inputPath}"`;
                
                await new Promise((resolve, reject) => {
                    exec(cmd, (error, stdout, stderr) => {
                        if (error) {
                            console.error(`Error converting file: ${error.message}`);
                            reject(error);
                            return;
                        }
                        resolve();
                    });
                });
            } else {
                // Fallback PDF generation using pdf-lib
                const pdfDoc = await PDFDocument.create();
                const page = pdfDoc.addPage([595, 842]); // A4 size
                
                // Add text to the PDF indicating this is a placeholder
                const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
                page.drawText(`Converted from: ${file.originalname}`, {
                    x: 50,
                    y: 800,
                    size: 14,
                    font
                });
                
                page.drawText('LibreOffice not installed for proper Word conversion.', {
                    x: 50,
                    y: 750,
                    size: 12,
                    font
                });
                
                page.drawText('Please install LibreOffice for full functionality.', {
                    x: 50,
                    y: 720,
                    size: 12,
                    font
                });
                
                // Save the PDF
                const pdfBytes = await pdfDoc.save();
                fs.writeFileSync(outputPath, pdfBytes);
            }
            
            // Generate a unique ID for the result
            const resultId = uuidv4();
            
            results.push({
                id: resultId,
                originalName: file.originalname,
                pdfName: outputFilename,
                pdfPath: `/output/${outputFilename}`,
                size: fs.statSync(outputPath).size
            });
        }
        
        res.json({
            success: true,
            message: `Successfully converted ${req.files.length} file(s)`,
            results: results
        });
    } catch (error) {
        console.error('Conversion error:', error);
        res.status(500).json({
            success: false,
            message: 'Error converting files',
            error: error.message
        });
    }
});

// API endpoint for Image to PDF conversion
app.post('/api/convert-image', upload.array('files', 20), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'No files uploaded' });
        }
        
        console.log(`Starting conversion of ${req.files.length} image(s) to PDF`);
        console.log('Files:', req.files.map(f => ({ name: f.originalname, path: f.path, size: f.size })));
        
        const conversionOptions = JSON.parse(req.body.options || '{}');
        console.log('Conversion options:', conversionOptions);
        
        const results = [];
        
        try {
            // Set page size based on options
            let pageWidth = 595; // A4 width in points (default)
            let pageHeight = 842; // A4 height in points (default)
            
            if (conversionOptions.pageSize) {
                switch (conversionOptions.pageSize) {
                    case 'letter':
                        pageWidth = 612; // 8.5 inches
                        pageHeight = 792; // 11 inches
                        break;
                    case 'legal':
                        pageWidth = 612; // 8.5 inches
                        pageHeight = 1008; // 14 inches
                        break;
                    // A4 is the default
                }
            }
            
            // Handle orientation
            if (conversionOptions.orientation === 'landscape') {
                [pageWidth, pageHeight] = [pageHeight, pageWidth];
            }
            
            // Check if we should combine all images into one PDF or create separate PDFs
            const shouldCombine = conversionOptions.combine === 'combine';
            
            // Process each image
            let successfulImages = 0;
            let failedImages = 0;
            
            if (shouldCombine || req.files.length === 1) {
                // Create a single PDF with all images
                const pdfDoc = await PDFDocument.create();
                
                for (const file of req.files) {
                    try {
                        const inputPath = file.path;
                        console.log(`Processing image: ${file.originalname} at ${inputPath}`);
                        
                        // Check if file is SVG
                        const isSvg = path.extname(file.originalname).toLowerCase() === '.svg';
                        let pngBuffer;
                        
                        if (isSvg) {
                            console.log('Processing SVG file');
                            try {
                                // For SVG, read the file directly
                                const svgContent = fs.readFileSync(inputPath, 'utf8');
                                
                                // Create a PNG from SVG using Sharp
                                pngBuffer = await sharp(Buffer.from(svgContent))
                                    .resize({
                                        width: 800,
                                        height: 600,
                                        fit: 'inside',
                                        withoutEnlargement: true
                                    })
                                    .toFormat('png')
                                    .toBuffer();
                                    
                                console.log(`Converted SVG to PNG buffer, size: ${pngBuffer.length} bytes`);
                            } catch (svgError) {
                                console.error('Error processing SVG:', svgError);
                                throw new Error(`Failed to convert SVG: ${svgError.message}`);
                            }
                        } else {
                            // Regular image processing
                            // Read image with sharp
                            const image = sharp(inputPath);
                            const metadata = await image.metadata();
                            console.log(`Image metadata:`, metadata);
                            
                            // Apply image quality settings if specified
                            if (conversionOptions.quality) {
                                switch (conversionOptions.quality) {
                                    case 'high':
                                        image.jpeg({ quality: 90 }).png({ quality: 90 });
                                        break;
                                    case 'medium':
                                        image.jpeg({ quality: 70 }).png({ quality: 70 });
                                        break;
                                    case 'low':
                                        image.jpeg({ quality: 50 }).png({ quality: 50 });
                                        break;
                                }
                            }
                            
                            // Convert image to PNG format for embedding
                            pngBuffer = await image.toFormat('png').toBuffer();
                            console.log(`Converted image to PNG buffer, size: ${pngBuffer.length} bytes`);
                        }
                        
                        // Embed the image into the PDF
                        const pngImage = await pdfDoc.embedPng(pngBuffer);
                        
                        // Get image dimensions
                        const imgDimensions = isSvg 
                            ? { width: 800, height: 600 } // Default dimensions for SVG
                            : await sharp(pngBuffer).metadata();
                        
                        // Add a page to the PDF
                        const page = pdfDoc.addPage([pageWidth, pageHeight]);
                        
                        // Calculate dimensions and position based on fit option
                        let width, height, x, y;
                        
                        const aspectRatio = imgDimensions.width / imgDimensions.height;
                        
                        switch (conversionOptions.fit || 'contain') {
                            case 'contain':
                                // Fit image within page while maintaining aspect ratio
                                if (aspectRatio > pageWidth / pageHeight) {
                                    width = pageWidth - 40; // Margins
                                    height = width / aspectRatio;
                                } else {
                                    height = pageHeight - 40; // Margins
                                    width = height * aspectRatio;
                                }
                                x = (pageWidth - width) / 2;
                                y = (pageHeight - height) / 2;
                                break;
                                
                            case 'cover':
                                // Fill page while maintaining aspect ratio (may crop image)
                                if (aspectRatio > pageWidth / pageHeight) {
                                    height = pageHeight;
                                    width = height * aspectRatio;
                                } else {
                                    width = pageWidth;
                                    height = width / aspectRatio;
                                }
                                x = (pageWidth - width) / 2;
                                y = (pageHeight - height) / 2;
                                break;
                                
                            case 'stretch':
                                // Stretch to fill page (ignores aspect ratio)
                                width = pageWidth;
                                height = pageHeight;
                                x = 0;
                                y = 0;
                                break;
                        }
                        
                        // Draw the image on the page
                        page.drawImage(pngImage, {
                            x: x,
                            y: y,
                            width: width,
                            height: height
                        });
                        
                        console.log(`Added image to PDF with dimensions x:${x}, y:${y}, width:${width}, height:${height}`);
                        successfulImages++;
                    } catch (imgError) {
                        console.error(`Error processing image ${file.originalname}:`, imgError);
                        failedImages++;
                        // Continue with next image instead of failing the whole batch
                    }
                }
                
                // If no images were processed successfully, fail the conversion
                if (successfulImages === 0) {
                    throw new Error('Failed to process any images. Please check file formats and try again.');
                }
                
                // Save the PDF to a file
                const timestamp = Date.now();
                const pdfName = shouldCombine ? `combined_images_${timestamp}.pdf` : 
                    `${req.files[0].originalname.replace(/[^a-zA-Z0-9.]/g, '_').replace(/\.[^/.]+$/, '')}_${timestamp}.pdf`;
                
                const outputPath = path.join(outputDir, pdfName);
                
                console.log(`Saving PDF to ${outputPath}`);
                const pdfBytes = await pdfDoc.save();
                
                // Save the PDF file
                try {
                    fs.writeFileSync(outputPath, pdfBytes);
                    console.log(`PDF saved, size: ${pdfBytes.length} bytes`);
                } catch (writeError) {
                    console.error(`Error saving PDF file: ${writeError.message}`);
                    throw new Error(`Could not save PDF file: ${writeError.message}`);
                }
                
                // Generate a unique ID for the result
                const resultId = uuidv4();
                
                // Get file size (handle error if file stat fails)
                let fileSize = pdfBytes.length;
                try {
                    fileSize = fs.statSync(outputPath).size;
                } catch (statError) {
                    console.error(`Error getting file stats: ${statError.message}`);
                }
                console.log(`Final PDF file size: ${fileSize} bytes`);
                
                results.push({
                    id: resultId,
                    originalName: shouldCombine ? `${req.files.length} images combined.pdf` : req.files[0].originalname,
                    pdfName: pdfName,
                    pdfPath: `/output/${pdfName}`,
                    size: fileSize
                });
            } else {
                // Create separate PDFs for each image
                for (const file of req.files) {
                    try {
                        const pdfDoc = await PDFDocument.create();
                        const inputPath = file.path;
                        console.log(`Processing image: ${file.originalname} at ${inputPath}`);
                        
                        // Check if file is SVG
                        const isSvg = path.extname(file.originalname).toLowerCase() === '.svg';
                        let pngBuffer;
                        
                        if (isSvg) {
                            // Process SVG file
                            const svgContent = fs.readFileSync(inputPath, 'utf8');
                            pngBuffer = await sharp(Buffer.from(svgContent))
                                .resize({
                                    width: 800,
                                    height: 600,
                                    fit: 'inside',
                                    withoutEnlargement: true
                                })
                                .toFormat('png')
                                .toBuffer();
                        } else {
                            // Process regular image
                            const image = sharp(inputPath);
                            
                            // Apply image quality settings if specified
                            if (conversionOptions.quality) {
                                switch (conversionOptions.quality) {
                                    case 'high':
                                        image.jpeg({ quality: 90 }).png({ quality: 90 });
                                        break;
                                    case 'medium':
                                        image.jpeg({ quality: 70 }).png({ quality: 70 });
                                        break;
                                    case 'low':
                                        image.jpeg({ quality: 50 }).png({ quality: 50 });
                                        break;
                                }
                            }
                            
                            // Convert image to PNG format for embedding
                            pngBuffer = await image.toFormat('png').toBuffer();
                        }
                        
                        // Embed the image into the PDF
                        const pngImage = await pdfDoc.embedPng(pngBuffer);
                        
                        // Get image dimensions
                        const imgDimensions = isSvg 
                            ? { width: 800, height: 600 } // Default dimensions for SVG
                            : await sharp(pngBuffer).metadata();
                        
                        // Add a page to the PDF
                        const page = pdfDoc.addPage([pageWidth, pageHeight]);
                        
                        // Calculate dimensions and position based on fit option
                        let width, height, x, y;
                        const aspectRatio = imgDimensions.width / imgDimensions.height;
                        
                        switch (conversionOptions.fit || 'contain') {
                            case 'contain':
                                // Fit image within page while maintaining aspect ratio
                                if (aspectRatio > pageWidth / pageHeight) {
                                    width = pageWidth - 40; // Margins
                                    height = width / aspectRatio;
                                } else {
                                    height = pageHeight - 40; // Margins
                                    width = height * aspectRatio;
                                }
                                x = (pageWidth - width) / 2;
                                y = (pageHeight - height) / 2;
                                break;
                                
                            case 'cover':
                                // Fill page while maintaining aspect ratio (may crop image)
                                if (aspectRatio > pageWidth / pageHeight) {
                                    height = pageHeight;
                                    width = height * aspectRatio;
                                } else {
                                    width = pageWidth;
                                    height = width / aspectRatio;
                                }
                                x = (pageWidth - width) / 2;
                                y = (pageHeight - height) / 2;
                                break;
                                
                            case 'stretch':
                                // Stretch to fill page (ignores aspect ratio)
                                width = pageWidth;
                                height = pageHeight;
                                x = 0;
                                y = 0;
                                break;
                        }
                        
                        // Draw the image on the page
                        page.drawImage(pngImage, {
                            x: x,
                            y: y,
                            width: width,
                            height: height
                        });
                        
                        // Save the PDF to a file
                        const timestamp = Date.now();
                        const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
                        const pdfName = `${safeOriginalName.replace(/\.[^/.]+$/, '')}_${timestamp}.pdf`;
                        const outputPath = path.join(outputDir, pdfName);
                        
                        console.log(`Saving PDF to ${outputPath}`);
                        const pdfBytes = await pdfDoc.save();
                        
                        // Save the PDF file
                        fs.writeFileSync(outputPath, pdfBytes);
                        
                        // Generate a unique ID for the result
                        const resultId = uuidv4();
                        
                        // Get file size
                        let fileSize = pdfBytes.length;
                        try {
                            fileSize = fs.statSync(outputPath).size;
                        } catch (statError) {
                            console.error(`Error getting file stats: ${statError.message}`);
                        }
                        
                        results.push({
                            id: resultId,
                            originalName: file.originalname,
                            pdfName: pdfName,
                            pdfPath: `/output/${pdfName}`,
                            size: fileSize
                        });
                        
                        successfulImages++;
                    } catch (imgError) {
                        console.error(`Error processing image ${file.originalname}:`, imgError);
                        failedImages++;
                    }
                }
            }
            
            // Add processing summary to response
            const summaryMessage = failedImages > 0 
                ? `Successfully converted ${successfulImages} image(s) to PDF. ${failedImages} image(s) failed.` 
                : `Successfully converted ${successfulImages} image(s) to PDF.`;
                
            console.log('Successfully completed conversion');
            res.json({
                success: true,
                message: summaryMessage,
                results: results
            });
        } catch (error) {
            console.error('PDF creation error:', error);
            throw new Error(`Error creating PDF: ${error.message}`);
        }
    } catch (error) {
        console.error('Conversion error:', error);
        res.status(500).json({
            success: false,
            message: 'Error converting images to PDF',
            error: error.message
        });
    }
});

// Make sure both folders have proper permissions
try {
    fs.chmodSync(uploadsDir, 0o777);
    fs.chmodSync(outputDir, 0o777);
    console.log('Successfully set proper permissions on directories');
} catch (error) {
    console.error(`Error setting directory permissions: ${error.message}`);
    // Permission errors are non-fatal, continue execution
}

// Add a debug route to check server health
app.get('/api/check-server', (req, res) => {
    res.json({
        status: 'ok',
        time: new Date().toISOString(),
        directories: {
            uploads: {
                path: uploadsDir,
                exists: fs.existsSync(uploadsDir),
                writable: isWritable(uploadsDir)
            },
            output: {
                path: outputDir,
                exists: fs.existsSync(outputDir),
                writable: isWritable(outputDir)
            }
        }
    });
});

// Helper function to check if a directory is writable
function isWritable(directory) {
    try {
        const testFile = path.join(directory, `_test_${Date.now()}.txt`);
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        return true;
    } catch (error) {
        return false;
    }
}

// Add a HEAD request handler for file existence check
app.head('/api/download/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        console.log(`HEAD request for file: ${filename}`);
        
        // Sanitize filename to prevent directory traversal attacks
        const sanitizedFilename = path.basename(filename);
        const filePath = path.join(outputDir, sanitizedFilename);
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.error(`File not found on HEAD request: ${filePath}`);
            return res.status(404).send();
        }
        
        res.setHeader('Content-Type', 'application/pdf');
        res.status(200).send();
    } catch (error) {
        console.error('HEAD request error:', error);
        res.status(500).send();
    }
});

// Add a route for listing available files (helpful for debugging)
app.get('/api/list-files', (req, res) => {
    try {
        const files = fs.readdirSync(outputDir);
        res.json({
            success: true,
            files: files
        });
    } catch (error) {
        console.error('Error listing files:', error);
        res.status(500).json({
            success: false,
            message: 'Error listing files',
            error: error.message
        });
    }
});

// Add a fallback route for any PDF requests that might be missing
app.get('/output/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        console.log(`Fallback output request for file: ${filename}`);
        
        // Sanitize filename to prevent directory traversal attacks
        const sanitizedFilename = path.basename(filename);
        const filePath = path.join(outputDir, sanitizedFilename);
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.error(`File not found in fallback route: ${filePath}`);
            return res.status(404).send('File not found');
        }
        
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(sanitizedFilename)}"`);
        res.setHeader('Content-Type', 'application/pdf');
        res.sendFile(filePath);
    } catch (error) {
        console.error('Fallback route error:', error);
        res.status(500).send('Error retrieving file');
    }
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Add a debug route to check dependencies
app.get('/api/check-dependencies', (req, res) => {
    const dependencies = {
        'pdf-lib': checkDependency('pdf-lib'),
        'sharp': checkDependency('sharp'),
        'multer': checkDependency('multer'),
        'express': checkDependency('express'),
        'cors': checkDependency('cors'),
        'uuid': checkDependency('uuid'),
        'libreoffice': checkLibreOffice()
    };
    
    res.json({
        status: 'ok',
        dependencies: dependencies
    });
});

// Helper function to check if a Node.js dependency is installed
function checkDependency(name) {
    try {
        require.resolve(name);
        return { installed: true, version: require(`${name}/package.json`).version };
    } catch (error) {
        return { installed: false, error: error.message };
    }
}

// Helper function to check if LibreOffice is installed
function checkLibreOffice() {
    if (process.platform === 'win32') {
        try {
            fs.accessSync("C:\\Program Files\\LibreOffice\\program\\soffice.exe", fs.constants.F_OK);
            return { installed: true, path: "C:\\Program Files\\LibreOffice\\program\\soffice.exe" };
        } catch (err) {
            // Try other common locations
            const otherPaths = [
                "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
                "C:\\LibreOffice\\program\\soffice.exe"
            ];
            
            for (const path of otherPaths) {
                try {
                    fs.accessSync(path, fs.constants.F_OK);
                    return { installed: true, path: path };
                } catch (e) {
                    // Continue checking other paths
                }
            }
            
            return { installed: false, error: "LibreOffice not found in common locations" };
        }
    } else {
        try {
            const result = require('child_process').execSync('which soffice').toString().trim();
            return { installed: true, path: result };
        } catch (err) {
            return { installed: false, error: err.message };
        }
    }
}

// Global error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    
    // Check if headers have already been sent
    if (res.headersSent) {
        return next(err);
    }
    
    // Handle multer errors
    if (err instanceof multer.MulterError) {
        return res.status(400).json({
            success: false,
            message: `File upload error: ${err.message}`,
            code: err.code
        });
    }
    
    // Handle other errors
    res.status(500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});

// Debug API endpoint for testing
app.get('/api/debug/status', (req, res) => {
    const status = {
        success: true,
        message: 'Server is running',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        config: {
            uploadsDir: uploadsDir,
            outputDir: outputDir,
            port: port
        },
        directories: {
            uploads: fs.existsSync(uploadsDir),
            output: fs.existsSync(outputDir)
        },
        libreOfficeInstalled: checkLibreOffice()
    };
    
    res.json(status);
});

// Simple text file to PDF conversion for testing
app.post('/api/debug/convert-text', async (req, res) => {
    try {
        const textContent = req.body.text || 'Test PDF document';
        const filename = `text_${Date.now()}.pdf`;
        const outputPath = path.join(outputDir, filename);
        
        // Create a PDF from text
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595, 842]); // A4 size
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        
        // Split text into lines
        const words = textContent.split(' ');
        let lines = [];
        let currentLine = '';
        
        words.forEach(word => {
            if ((currentLine + word).length > 60) {
                lines.push(currentLine);
                currentLine = word + ' ';
            } else {
                currentLine += word + ' ';
            }
        });
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        // Add lines to the page
        lines.forEach((line, index) => {
            page.drawText(line, {
                x: 50,
                y: 750 - (index * 20),
                size: 12,
                font
            });
        });
        
        // Save the PDF
        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(outputPath, pdfBytes);
        
        res.json({
            success: true,
            message: 'Text converted to PDF successfully',
            filename: filename,
            pdfUrl: `/output/${filename}`
        });
    } catch (error) {
        console.error('Error in text conversion:', error);
        res.status(500).json({
            success: false,
            message: 'Error converting text to PDF',
            error: error.message
        });
    }
});

// API endpoint for merging multiple PDFs
app.post('/api/merge-pdfs', upload.array('files', 20), async (req, res) => {
    try {
        if (!req.files || req.files.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'At least two PDF files are required for merging'
            });
        }
        
        console.log(`Starting merge of ${req.files.length} PDF file(s)`);
        
        // Verify all files are PDFs
        const pdfFiles = req.files.filter(file => 
            path.extname(file.originalname).toLowerCase() === '.pdf');
        
        if (pdfFiles.length < req.files.length) {
            return res.status(400).json({
                success: false,
                message: 'All files must be PDF format'
            });
        }
        
        // Create a new merged PDF
        const mergedPdf = await PDFDocument.create();
        
        // Process each PDF file
        for (const file of pdfFiles) {
            try {
                console.log(`Processing PDF: ${file.originalname}`);
                
                // Read the PDF file
                const pdfBytes = fs.readFileSync(file.path);
                
                // Load the PDF document
                const pdfDoc = await PDFDocument.load(pdfBytes);
                
                // Get all pages
                const pages = pdfDoc.getPages();
                console.log(`Found ${pages.length} pages in ${file.originalname}`);
                
                // Copy pages to the merged PDF
                const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
                copiedPages.forEach(page => {
                    mergedPdf.addPage(page);
                });
                
                console.log(`Added ${copiedPages.length} pages from ${file.originalname} to merged PDF`);
            } catch (error) {
                console.error(`Error processing ${file.originalname}:`, error);
                throw new Error(`Failed to process ${file.originalname}: ${error.message}`);
            }
        }
        
        // Generate output filename
        const timestamp = Date.now();
        const outputFilename = `merged_${timestamp}.pdf`;
        const outputPath = path.join(outputDir, outputFilename);
        
        // Save the merged PDF
        const mergedPdfBytes = await mergedPdf.save();
        fs.writeFileSync(outputPath, mergedPdfBytes);
        
        console.log(`Merged PDF saved to ${outputPath}`);
        
        // Return success response
        res.json({
            success: true,
            message: `Successfully merged ${pdfFiles.length} PDF files`,
            result: {
                id: uuidv4(),
                pdfName: outputFilename,
                pdfPath: `/output/${outputFilename}`,
                size: fs.statSync(outputPath).size,
                pageCount: mergedPdf.getPageCount()
            }
        });
    } catch (error) {
        console.error('PDF merge error:', error);
        res.status(500).json({
            success: false,
            message: 'Error merging PDF files',
            error: error.message
        });
    }
});

// API endpoint for splitting a PDF (extracting specific pages)
app.post('/api/split-pdf', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false, 
                message: 'No PDF file uploaded'
            });
        }
        
        // Verify file is PDF
        if (path.extname(req.file.originalname).toLowerCase() !== '.pdf') {
            return res.status(400).json({
                success: false, 
                message: 'Uploaded file must be a PDF'
            });
        }
        
        // Parse page ranges
        const pageRanges = req.body.pageRanges || '';
        if (!pageRanges) {
            return res.status(400).json({
                success: false, 
                message: 'Page ranges must be specified'
            });
        }
        
        console.log(`Processing PDF split request for file: ${req.file.originalname}`);
        console.log(`Page ranges: ${pageRanges}`);
        
        // Read the source PDF
        const pdfBytes = fs.readFileSync(req.file.path);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        
        // Get total page count
        const totalPages = pdfDoc.getPageCount();
        console.log(`Total pages in document: ${totalPages}`);
        
        // Parse page ranges (format: "1,3,5-7,10-15")
        const pageNumbers = [];
        try {
            pageRanges.split(',').forEach(range => {
                range = range.trim();
                if (range.includes('-')) {
                    // Handle range (e.g., "5-7")
                    const [start, end] = range.split('-').map(num => parseInt(num.trim(), 10));
                    if (isNaN(start) || isNaN(end) || start < 1 || end > totalPages || start > end) {
                        throw new Error(`Invalid page range: ${range}`);
                    }
                    for (let i = start; i <= end; i++) {
                        pageNumbers.push(i);
                    }
                } else {
                    // Handle single page (e.g., "3")
                    const pageNum = parseInt(range, 10);
                    if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
                        throw new Error(`Invalid page number: ${range}`);
                    }
                    pageNumbers.push(pageNum);
                }
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        
        // Remove duplicates and sort
        const uniquePages = [...new Set(pageNumbers)].sort((a, b) => a - b);
        console.log(`Pages to extract: ${uniquePages.join(', ')}`);
        
        // Create a new PDF with the selected pages
        const newPdfDoc = await PDFDocument.create();
        for (const pageNum of uniquePages) {
            // PDF pages are 0-indexed in the library, but 1-indexed in user input
            const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageNum - 1]);
            newPdfDoc.addPage(copiedPage);
        }
        
        // Generate output filename
        const timestamp = Date.now();
        const baseName = path.basename(req.file.originalname, '.pdf');
        const outputFilename = `${baseName}_extracted_${timestamp}.pdf`;
        const outputPath = path.join(outputDir, outputFilename);
        
        // Save the new PDF
        const newPdfBytes = await newPdfDoc.save();
        fs.writeFileSync(outputPath, newPdfBytes);
        
        console.log(`Split PDF saved to ${outputPath}`);
        
        // Return success response
        res.json({
            success: true,
            message: `Successfully extracted ${uniquePages.length} pages from PDF`,
            result: {
                id: uuidv4(),
                pdfName: outputFilename,
                pdfPath: `/output/${outputFilename}`,
                size: fs.statSync(outputPath).size,
                pageCount: uniquePages.length,
                extractedPages: uniquePages
            }
        });
    } catch (error) {
        console.error('PDF split error:', error);
        res.status(500).json({
            success: false,
            message: 'Error splitting PDF file',
            error: error.message
        });
    }
});

// API endpoint for adding a watermark to a PDF
app.post('/api/add-watermark', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false, 
                message: 'No PDF file uploaded'
            });
        }
        
        // Verify file is PDF
        if (path.extname(req.file.originalname).toLowerCase() !== '.pdf') {
            return res.status(400).json({
                success: false, 
                message: 'Uploaded file must be a PDF'
            });
        }
        
        // Get watermark text and options
        const watermarkText = req.body.text || 'CONFIDENTIAL';
        const options = {
            color: req.body.color || '#FF0000',
            opacity: parseFloat(req.body.opacity || '0.3'),
            fontSize: parseInt(req.body.fontSize || '50', 10),
            diagonal: req.body.diagonal === 'true',
            repeat: req.body.repeat === 'true'
        };
        
        console.log(`Processing watermark request for file: ${req.file.originalname}`);
        console.log(`Watermark text: "${watermarkText}"`);
        console.log('Options:', options);
        
        // Load the source PDF
        const pdfBytes = fs.readFileSync(req.file.path);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        
        // Get total page count
        const totalPages = pdfDoc.getPageCount();
        console.log(`Total pages in document: ${totalPages}`);
        
        // Parse color (format: "#FF0000")
        const colorRgb = {
            r: parseInt(options.color.substring(1, 3), 16) / 255,
            g: parseInt(options.color.substring(3, 5), 16) / 255,
            b: parseInt(options.color.substring(5, 7), 16) / 255
        };
        
        // Add watermark to each page
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        
        for (let i = 0; i < totalPages; i++) {
            const page = pdfDoc.getPage(i);
            const { width, height } = page.getSize();
            
            // Calculate text dimensions
            const textWidth = font.widthOfTextAtSize(watermarkText, options.fontSize);
            const textHeight = font.heightAtSize(options.fontSize);
            
            // Define watermark placement function
            const addWatermark = (x, y, angle = 0) => {
                page.drawText(watermarkText, {
                    x,
                    y,
                    size: options.fontSize,
                    font: font,
                    color: rgb(colorRgb.r, colorRgb.g, colorRgb.b),
                    opacity: options.opacity,
                    rotate: { type: 'degrees', angle }
                });
            };
            
            if (options.repeat) {
                // Add repeated watermarks
                const spacingX = width / 2;
                const spacingY = height / 3;
                
                for (let row = 0; row < 3; row++) {
                    for (let col = 0; col < 2; col++) {
                        const x = col * spacingX + spacingX / 2 - textWidth / 2;
                        const y = row * spacingY + spacingY / 2 - textHeight / 2;
                        
                        if (options.diagonal) {
                            addWatermark(x + textWidth / 2, y + textHeight / 2, 45);
                        } else {
                            addWatermark(x, y);
                        }
                    }
                }
            } else {
                // Add single centered watermark
                const x = width / 2 - textWidth / 2;
                const y = height / 2 - textHeight / 2;
                
                if (options.diagonal) {
                    addWatermark(width / 2, height / 2, 45);
                } else {
                    addWatermark(x, y);
                }
            }
        }
        
        // Generate output filename
        const timestamp = Date.now();
        const baseName = path.basename(req.file.originalname, '.pdf');
        const outputFilename = `${baseName}_watermarked_${timestamp}.pdf`;
        const outputPath = path.join(outputDir, outputFilename);
        
        // Save the watermarked PDF
        const watermarkedBytes = await pdfDoc.save();
        fs.writeFileSync(outputPath, watermarkedBytes);
        
        console.log(`Watermarked PDF saved to ${outputPath}`);
        
        // Return success response
        res.json({
            success: true,
            message: `Successfully added watermark to PDF`,
            result: {
                id: uuidv4(),
                pdfName: outputFilename,
                pdfPath: `/output/${outputFilename}`,
                size: fs.statSync(outputPath).size,
                pageCount: totalPages
            }
        });
    } catch (error) {
        console.error('PDF watermark error:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding watermark to PDF',
            error: error.message
        });
    }
});

// API endpoint for password-protecting a PDF
app.post('/api/protect-pdf', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false, 
                message: 'No PDF file uploaded'
            });
        }
        
        // Verify file is PDF
        if (path.extname(req.file.originalname).toLowerCase() !== '.pdf') {
            return res.status(400).json({
                success: false, 
                message: 'Uploaded file must be a PDF'
            });
        }
        
        // Get passwords
        const userPassword = req.body.userPassword; // password to open the document
        const ownerPassword = req.body.ownerPassword || userPassword; // password for full permissions
        
        if (!userPassword) {
            return res.status(400).json({
                success: false, 
                message: 'User password is required'
            });
        }
        
        console.log(`Processing password protection request for: ${req.file.originalname}`);
        
        // Load the source PDF
        const pdfBytes = fs.readFileSync(req.file.path);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        
        // Get total page count
        const totalPages = pdfDoc.getPageCount();
        console.log(`Total pages in document: ${totalPages}`);
        
        // Set encryption options
        pdfDoc.encrypt({
            userPassword: userPassword,
            ownerPassword: ownerPassword,
            // Permissions to specify what the user can do with the PDF
            permissions: {
                printing: req.body.allowPrinting === 'true' ? 'highResolution' : 'none',
                modifying: req.body.allowModifying === 'true',
                copying: req.body.allowCopying === 'true',
                annotating: req.body.allowAnnotating === 'true',
                fillingForms: req.body.allowFillingForms !== 'false',
                contentAccessibility: req.body.allowAccessibility !== 'false',
                documentAssembly: req.body.allowAssembly === 'true',
            },
        });
        
        // Generate output filename
        const timestamp = Date.now();
        const baseName = path.basename(req.file.originalname, '.pdf');
        const outputFilename = `${baseName}_protected_${timestamp}.pdf`;
        const outputPath = path.join(outputDir, outputFilename);
        
        // Save the protected PDF
        const protectedPdfBytes = await pdfDoc.save();
        fs.writeFileSync(outputPath, protectedPdfBytes);
        
        console.log(`Password-protected PDF saved to ${outputPath}`);
        
        // Return success response
        res.json({
            success: true,
            message: `Successfully password-protected the PDF`,
            result: {
                id: uuidv4(),
                pdfName: outputFilename,
                pdfPath: `/output/${outputFilename}`,
                size: fs.statSync(outputPath).size,
                pageCount: totalPages,
                isProtected: true
            }
        });
    } catch (error) {
        console.error('PDF protection error:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding password protection to PDF',
            error: error.message
        });
    }
});

// Add a debug route for direct file creation
app.get('/api/debug/create-test-file', (req, res) => {
    try {
        const testPdfPath = path.join(outputDir, 'test_output.pdf');
        
        // Create a simple PDF
        const createPdf = async () => {
            const pdfDoc = await PDFDocument.create();
            const page = pdfDoc.addPage([595, 842]); // A4 size
            
            // Add text to the PDF
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            page.drawText('This is a test PDF file', {
                x: 50,
                y: 800,
                size: 24,
                font
            });
            
            page.drawText('Created for debugging purposes', {
                x: 50,
                y: 750,
                size: 12,
                font
            });
            
            // Save the PDF
            const pdfBytes = await pdfDoc.save();
            fs.writeFileSync(testPdfPath, pdfBytes);
            
            return pdfBytes.length;
        };
        
        createPdf().then(size => {
            res.json({
                success: true,
                message: 'Test PDF file created successfully',
                filePath: testPdfPath,
                fileSize: size,
                downloadUrl: '/output/test_output.pdf'
            });
        }).catch(error => {
            res.status(500).json({
                success: false,
                message: 'Error creating test PDF',
                error: error.message
            });
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error in debug endpoint',
            error: error.message
        });
    }
});

// Add route not found handler (404)
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        console.log(`API route not found: ${req.method} ${req.url}`);
        // For API routes, return JSON error
        return res.status(404).json({
            success: false,
            message: `Route not found: ${req.method} ${req.path}`,
            path: req.path
        });
    }
    // For non-API routes, next() will eventually serve index.html or 404
    next();
});

// Log server startup info for debugging purposes
console.log('Starting omPDF Converter Pro server...');
console.log('Current directory:', __dirname);
console.log('Node version:', process.version);

// Check if required directories exist
const requiredDirs = ['node_modules', 'uploads', 'output'];
for (const dir of requiredDirs) {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
        console.error(`ERROR: Required directory '${dir}' does not exist at ${dirPath}`);
    } else {
        console.log(`Directory '${dir}' exists at ${dirPath}`);
    }
}

// Log package status
const requiredPackages = ['express', 'multer', 'pdf-lib', 'sharp', 'cors', 'uuid'];
for (const pkg of requiredPackages) {
    try {
        require.resolve(pkg);
        console.log(`Package '${pkg}' is installed`);
    } catch (err) {
        console.error(`ERROR: Package '${pkg}' is not installed`);
    }
}

// Start the server
app.listen(port, () => {
    console.log(`omPDF Converter Pro server is running on port ${port}`);
}); 