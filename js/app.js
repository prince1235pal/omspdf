document.addEventListener('DOMContentLoaded', function() {
    // Initialize analytics tracking (mock)
    initAnalytics();
    
    // Prompt for subscription to newsletter
    setTimeout(() => {
        showSubscriptionPrompt();
    }, 60000); // Show after 1 minute
    
    // Track conversion metrics
    let totalConversions = 0;
    let successfulConversions = 0;
    
    // Tab switching functionality
    const tabButtons = document.querySelectorAll('.tab-btn');
    const toolContents = document.querySelectorAll('.tool-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            toolContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to the clicked button
            button.classList.add('active');
            
            // Show the corresponding content
            const toolId = button.getAttribute('data-tool');
            document.getElementById(toolId).classList.add('active');
        });
    });

    // FAQ accordion functionality
    const accordionItems = document.querySelectorAll('.accordion-item');
    
    accordionItems.forEach(item => {
        const header = item.querySelector('.accordion-header');
        const content = item.querySelector('.accordion-content');
        
        header.addEventListener('click', () => {
            // Toggle active class on the clicked item
            item.classList.toggle('active');
            
            // Close other accordion items
            accordionItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                }
            });
        });
    });

    // File upload handling for Word to PDF
    const wordUploadArea = document.getElementById('word-upload-area');
    const wordFileInput = document.getElementById('word-file-input');
    const wordFileList = document.getElementById('word-file-list');
    const wordConvertBtn = document.getElementById('word-convert-btn');
    
    setupFileUpload(wordUploadArea, wordFileInput, wordFileList, wordConvertBtn, ['.doc', '.docx'], 10, 20);

    // File upload handling for Image to PDF
    const imageUploadArea = document.getElementById('image-upload-area');
    const imageFileInput = document.getElementById('image-file-input');
    const imageFileList = document.getElementById('image-file-list');
    const imageConvertBtn = document.getElementById('image-convert-btn');
    
    setupFileUpload(imageUploadArea, imageFileInput, imageFileList, imageConvertBtn, ['.jpg', '.jpeg', '.png', '.bmp', '.webp'], 20, 10);

    // Conversion buttons click handlers
    wordConvertBtn.addEventListener('click', () => {
        convertFiles('word');
    });
    
    imageConvertBtn.addEventListener('click', () => {
        convertFiles('image');
    });

    // Download all and clear results buttons
    const downloadAllBtn = document.getElementById('download-all-btn');
    const clearResultsBtn = document.getElementById('clear-results-btn');
    
    downloadAllBtn.addEventListener('click', downloadAllFiles);
    clearResultsBtn.addEventListener('click', clearResults);

    // Modal functionality
    const previewModal = document.getElementById('preview-modal');
    const closeModalButtons = document.querySelectorAll('.close-modal, .close-preview-btn');
    
    closeModalButtons.forEach(button => {
        button.addEventListener('click', () => {
            previewModal.classList.remove('show');
        });
    });

    // Global click handler for preview and download buttons
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('preview-pdf')) {
            openPdfPreview(e.target.getAttribute('data-pdf-url'));
        } else if (e.target.classList.contains('download-pdf')) {
            downloadPdf(e.target.getAttribute('data-pdf-url'), e.target.getAttribute('data-pdf-name'));
        }
    });

    // Set up globals
    let totalFilesUploaded = 0;
    let totalBytesUploaded = 0;
    let pdfBytesGenerated = 0;
});

// Initialize analytics tracking
function initAnalytics() {
    console.log('Analytics initialized');
    
    // Track page views
    trackEvent('page_view', {
        page: window.location.pathname
    });
    
    // Track feature visibility
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                trackEvent('feature_view', {
                    feature: entry.target.id
                });
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });
    
    // Observe feature sections
    document.querySelectorAll('section[id]').forEach(section => {
        observer.observe(section);
    });
}

// Track events (mock implementation)
function trackEvent(eventName, data = {}) {
    console.log(`Event tracked: ${eventName}`, data);
    // In a real implementation, this would send data to an analytics service
}

// Show subscription prompt
function showSubscriptionPrompt() {
    // Check if already subscribed or dismissed
    if (localStorage.getItem('subscription_status')) {
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'subscription-modal';
    modal.innerHTML = `
        <div class="subscription-content">
            <button class="subscription-close"><i class="fas fa-times"></i></button>
            <h3>Stay Updated</h3>
            <p>Subscribe to our newsletter for the latest updates and exclusive offers.</p>
            <form id="subscription-form">
                <input type="email" placeholder="Your email address" required>
                <button type="submit" class="btn primary-btn">Subscribe</button>
            </form>
            <div class="subscription-footer">
                <label>
                    <input type="checkbox" id="dont-show-again">
                    Don't show this again
                </label>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Show with animation
    setTimeout(() => {
        modal.classList.add('show');
    }, 100);
    
    // Handle close
    modal.querySelector('.subscription-close').addEventListener('click', () => {
        closeSubscriptionPrompt(modal);
    });
    
    // Handle form submission
    modal.querySelector('#subscription-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = e.target.querySelector('input[type="email"]').value;
        
        // Mock submission
        showToast('Thank you for subscribing!', 'success');
        localStorage.setItem('subscription_status', 'subscribed');
        closeSubscriptionPrompt(modal);
        
        // Track event
        trackEvent('newsletter_subscribe', { email });
    });
    
    // Handle "don't show again"
    modal.querySelector('#dont-show-again').addEventListener('change', (e) => {
        if (e.target.checked) {
            localStorage.setItem('subscription_status', 'dismissed');
        } else {
            localStorage.removeItem('subscription_status');
        }
    });
    
    // Track view
    trackEvent('subscription_prompt_view');
}

// Close subscription prompt
function closeSubscriptionPrompt(modal) {
    modal.classList.remove('show');
    setTimeout(() => {
        modal.remove();
    }, 300);
}

// Function to set up file upload for both Word and Image sections
function setupFileUpload(uploadArea, fileInput, fileList, convertBtn, allowedExtensions, maxFiles, maxSizeMB) {
    // Drag and drop functionality
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.add('highlight');
        });
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.remove('highlight');
        });
    });
    
    uploadArea.addEventListener('drop', (e) => {
        const droppedFiles = Array.from(e.dataTransfer.files);
        handleFiles(droppedFiles);
    });
    
    // Click to browse files
    fileInput.addEventListener('change', () => {
        const selectedFiles = Array.from(fileInput.files);
        handleFiles(selectedFiles);
    });
    
    // Store the list of accepted files
    let acceptedFiles = [];
    
    // Handle the selected files
    function handleFiles(files) {
        // Filter by allowed extensions
        const validFiles = files.filter(file => {
            const ext = '.' + file.name.split('.').pop().toLowerCase();
            return allowedExtensions.includes(ext);
        });
        
        // Check if adding these files would exceed the maximum
        if (acceptedFiles.length + validFiles.length > maxFiles) {
            alert(`You can only upload a maximum of ${maxFiles} files at once.`);
            return;
        }
        
        // Filter by file size
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        const sizeValidFiles = validFiles.filter(file => {
            if (file.size > maxSizeBytes) {
                alert(`The file "${file.name}" exceeds the maximum size of ${maxSizeMB}MB.`);
                return false;
            }
            return true;
        });
        
        // Add valid files to the accepted files list
        acceptedFiles = [...acceptedFiles, ...sizeValidFiles];
        
        // Update the file list display
        updateFileList();
        
        // Enable/disable convert button
        if (acceptedFiles.length > 0) {
            convertBtn.disabled = false;
        } else {
            convertBtn.disabled = true;
        }
    }
    
    // Update the file list display
    function updateFileList() {
        fileList.innerHTML = '';
        
        acceptedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            const fileInfo = document.createElement('div');
            fileInfo.className = 'file-info';
            
            const fileIcon = document.createElement('i');
            const ext = file.name.split('.').pop().toLowerCase();
            
            if (['doc', 'docx'].includes(ext)) {
                fileIcon.className = 'fas fa-file-word file-icon';
            } else if (['jpg', 'jpeg', 'png', 'bmp', 'webp'].includes(ext)) {
                fileIcon.className = 'fas fa-file-image file-icon';
            } else {
                fileIcon.className = 'fas fa-file file-icon';
            }
            
            const fileName = document.createElement('span');
            fileName.className = 'file-name';
            fileName.textContent = file.name;
            
            const fileSize = document.createElement('span');
            fileSize.className = 'file-size';
            fileSize.textContent = formatFileSize(file.size);
            
            fileInfo.appendChild(fileIcon);
            fileInfo.appendChild(fileName);
            fileInfo.appendChild(fileSize);
            
            const fileActions = document.createElement('div');
            fileActions.className = 'file-actions';
            
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-file';
            deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
            deleteButton.addEventListener('click', () => {
                acceptedFiles.splice(index, 1);
                updateFileList();
                
                // Enable/disable convert button
                if (acceptedFiles.length > 0) {
                    convertBtn.disabled = false;
                } else {
                    convertBtn.disabled = true;
                }
            });
            
            fileActions.appendChild(deleteButton);
            
            fileItem.appendChild(fileInfo);
            fileItem.appendChild(fileActions);
            
            fileList.appendChild(fileItem);
        });
    }
    
    // Format file size
    function formatFileSize(bytes) {
        if (bytes < 1024) {
            return bytes + ' bytes';
        } else if (bytes < 1024 * 1024) {
            return (bytes / 1024).toFixed(1) + ' KB';
        } else {
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        }
    }
}

// Function to handle file conversion - enhanced with analytics
function convertFiles(type) {
    // Get the file input element and file list
    const fileInput = document.getElementById(`${type}-file-input`);
    const fileList = document.getElementById(`${type}-file-list`);
    let acceptedFiles = [];
    
    // Get the accepted files array from the file list
    const fileItems = fileList.querySelectorAll('.file-item');
    Array.from(fileItems).forEach((fileItem, index) => {
        acceptedFiles.push(fileInput.files[index]);
    });
    
    // Check if files are selected - use acceptedFiles array
    if (acceptedFiles.length === 0) {
        showToast('Please select at least one file to convert.', 'warning');
        return;
    }
    
    // Track start of conversion
    trackEvent('conversion_started', { type, files: acceptedFiles.length });
    
    // Show the conversion results section
    document.getElementById('conversion-results').classList.remove('hidden');
    
    // Get the selected conversion options
    const options = {};
    
    if (type === 'word') {
        options.pageSize = document.getElementById('word-page-size').value;
        options.orientation = document.getElementById('word-orientation').value;
        options.margins = document.getElementById('word-margins').value;
    } else if (type === 'image') {
        options.pageSize = document.getElementById('image-page-size').value;
        options.orientation = document.getElementById('image-orientation').value;
        options.quality = document.getElementById('image-quality').value;
        options.fit = document.getElementById('image-fit').value;
        options.combine = document.getElementById('image-combine').value;
    }
    
    // Disable the convert button during conversion
    const convertBtn = document.getElementById(`${type}-convert-btn`);
    const originalBtnText = convertBtn.textContent;
    convertBtn.disabled = true;
    convertBtn.innerHTML = '<span class="spinner"></span> Converting...';
    
    // Prepare FormData for the API request
    const formData = new FormData();
    
    // Add each file to the FormData - use acceptedFiles array instead of fileInput.files
    acceptedFiles.forEach(file => {
        formData.append('files', file);
    });
    
    // Add conversion options
    formData.append('options', JSON.stringify(options));
    
    // For debugging - simulate successful conversion in case the server isn't properly set up
    const useDebugMode = false; // Set to true to use debug mode
    const useDebugEndpoint = false; // Use a direct server debug endpoint instead of full conversion
    
    if (useDebugMode) {
        // Log that we're using debug mode
        console.log('*** USING DEBUG MODE - Server API call disabled ***');
        showToast('Using debug mode (server connection bypassed)', 'warning');
        
        setTimeout(() => {
            // Simulate result for each file
            acceptedFiles.forEach(file => {
                // Create a safe filename by removing special characters
                const safeFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
                const pdfName = `${safeFileName.replace(/\.[^/.]+$/, '')}.pdf`;
                
                const debugResult = {
                    id: `debug-${Date.now()}`,
                    originalName: file.name,
                    pdfName: pdfName,
                    size: file.size,
                    pdfPath: `/output/${pdfName}` // This would normally come from the server
                };
                addServerResultItem(debugResult);
            });
            
            // Reset the convert button
            convertBtn.disabled = false;
            convertBtn.textContent = originalBtnText;
            
            // Clear the file input and list
            fileInput.value = '';
            fileList.innerHTML = '';
            acceptedFiles = [];
        }, 1500);
        
        return;
    }

    // Use debug endpoint if enabled (fallback for when full conversion isn't working)
    if (useDebugEndpoint) {
        console.log('*** USING DEBUG ENDPOINT - Calling simplified API ***');
        showToast('Using debug endpoint for testing', 'warning');
        
        // Show a processing toast
        showToast(`Processing test file...`, 'info');
        
        // Call the debug endpoint to create a sample PDF
        fetch('/api/debug/create-test-file')
            .then(response => {
                console.log('Debug endpoint response status:', response.status);
                return response.json();
            })
            .then(data => {
                console.log('Debug endpoint success:', data);
                
                // Create a test result for each file (but using the same test PDF)
                acceptedFiles.forEach(file => {
                    const debugResult = {
                        id: `debug-${Date.now()}`,
                        originalName: file.name,
                        pdfName: 'test_output.pdf',
                        size: data.fileSize || 10000,
                        pdfPath: data.downloadUrl || '/output/test_output.pdf'
                    };
                    addServerResultItem(debugResult);
                });
                
                // Show success message
                showToast(data.message || 'Test PDF created successfully', 'success');
                
                // Reset the convert button
                convertBtn.disabled = false;
                convertBtn.textContent = originalBtnText;
                
                // Clear the file input and list
                fileInput.value = '';
                fileList.innerHTML = '';
                acceptedFiles = [];
            })
            .catch(error => {
                console.error('Debug endpoint error:', error);
                showToast(`Error with debug endpoint: ${error.message}`, 'error');
                
                // Reset the convert button
                convertBtn.disabled = false;
                convertBtn.textContent = originalBtnText;
            });
        
        return;
    }
    
    // Show a processing toast
    showToast(`Processing ${fileInput.files.length} file(s). Please wait...`, 'info');
    
    // Make the API request to the server
    console.log(`Making API request to: /api/convert-${type}`);
    fetch(`/api/convert-${type}`, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        // Log the response for debugging
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        // Handle specific HTTP status codes
        if (response.status === 404) {
            throw new Error(`API endpoint not found: /api/convert-${type}. Please check server configuration.`);
        }
        
        if (response.status === 500) {
            throw new Error('Server error occurred during conversion. Check server logs for details.');
        }
        
        // Check if the response is JSON
        const contentType = response.headers.get('content-type');
        console.log('Content type:', contentType);
        
        if (contentType && contentType.includes('application/json')) {
            return response.json().then(data => {
                if (!response.ok) {
                    // Handle JSON error response
                    console.error('Server error:', data);
                    throw new Error(data.message || 'Conversion failed');
                }
                return data;
            });
        } else {
            // Handle non-JSON response
            return response.text().then(text => {
                console.error('Unexpected response format:', text);
                if (text.length === 0) {
                    throw new Error('Empty server response. Server may not be running properly.');
                } else if (text.includes('<!DOCTYPE html>')) {
                    throw new Error('Server returned HTML instead of JSON. API endpoint may be incorrect.');
                } else {
                    throw new Error(`Unexpected server response format: ${text.substring(0, 100)}...`);
                }
            });
        }
    })
    .then(data => {
        // Process successful conversion
        console.log('Conversion success:', data);
        
        if (data.success) {
            // Track successful conversion
            trackEvent('conversion_success', { 
                type, 
                files: data.results.length,
                total_size: data.results.reduce((sum, item) => sum + item.size, 0)
            });
            
            // No need to update metrics that don't exist
            // successfulConversions += data.results.length;
            
            // Show success message
            showToast(data.message || `Successfully converted ${data.results.length} file(s)`, 'success');
            
            // Add each result to the results list
            data.results.forEach(result => {
                addServerResultItem(result);
            });
            
            // Reset the convert button
            convertBtn.disabled = false;
            convertBtn.textContent = originalBtnText;
            
            // Clear the file input and list
            fileInput.value = '';
            fileList.innerHTML = '';
            acceptedFiles = [];
        } else {
            throw new Error(data.message || 'Conversion failed');
        }
    })
    .catch(error => {
        // Track error
        trackEvent('conversion_error', { type, error: error.message });
        
        console.error('Conversion error:', error);
        
        // Check if it's a network error
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            showToast('Network error: Could not connect to server. Please make sure the server is running.', 'error');
        } else {
            showToast(`Error converting files: ${error.message}`, 'error');
        }
        
        // Reset the convert button
        convertBtn.disabled = false;
        convertBtn.textContent = originalBtnText;
    });
}

// Function to add a result item from server response to the results list
function addServerResultItem(result) {
    const resultsList = document.getElementById('results-list');
    
    const resultItem = document.createElement('div');
    resultItem.className = 'result-item';
    
    const resultInfo = document.createElement('div');
    resultInfo.className = 'result-info';
    
    const resultIcon = document.createElement('i');
    resultIcon.className = 'fas fa-check-circle result-icon';
    
    const resultName = document.createElement('span');
    resultName.className = 'result-name';
    resultName.textContent = result.pdfName;
    
    const resultDetails = document.createElement('span');
    resultDetails.className = 'result-details';
    resultDetails.textContent = `Converted from ${result.originalName} (${formatFileSize(result.size)})`;
    
    resultInfo.appendChild(resultIcon);
    resultInfo.appendChild(resultName);
    resultInfo.appendChild(resultDetails);
    
    const resultActions = document.createElement('div');
    resultActions.className = 'result-actions';
    
    // Use pdfPath if available, otherwise use pdfName
    const pdfUrl = result.pdfPath || result.pdfName;
    
    const previewButton = document.createElement('button');
    previewButton.className = 'preview-pdf';
    previewButton.setAttribute('data-pdf-url', pdfUrl);
    previewButton.innerHTML = '<i class="fas fa-eye"></i> Preview';
    
    const downloadButton = document.createElement('button');
    downloadButton.className = 'download-pdf';
    downloadButton.setAttribute('data-pdf-url', pdfUrl);
    downloadButton.setAttribute('data-pdf-name', result.pdfName);
    downloadButton.innerHTML = '<i class="fas fa-download"></i> Download';
    
    resultActions.appendChild(previewButton);
    resultActions.appendChild(downloadButton);
    
    resultItem.appendChild(resultInfo);
    resultItem.appendChild(resultActions);
    
    resultsList.appendChild(resultItem);
    
    console.log('Added result item with URL:', pdfUrl);
}

// Function to download all PDF files
function downloadAllFiles() {
    const downloadButtons = document.querySelectorAll('.download-pdf');
    
    downloadButtons.forEach(button => {
        setTimeout(() => {
            button.click();
        }, 500);
    });
}

// Function to clear all results
function clearResults() {
    document.getElementById('results-list').innerHTML = '';
    document.getElementById('conversion-results').classList.add('hidden');
}

// Function to open PDF preview modal
function openPdfPreview(pdfUrl) {
    const previewModal = document.getElementById('preview-modal');
    const previewContainer = document.getElementById('pdf-preview-container');
    const downloadPreviewBtn = document.getElementById('download-preview-btn');
    
    // Clear previous content
    previewContainer.innerHTML = '<div class="spinner" style="margin: 20px auto;"></div>';
    
    // Show the modal
    previewModal.classList.add('show');
    
    // Determine the correct URL for the PDF
    let fullPdfUrl = pdfUrl;
    
    // Special case for test_output.pdf
    if (pdfUrl.includes('test_output.pdf')) {
        console.log('Preview handling for test output file');
        fullPdfUrl = '/output/test_output.pdf';
    } else {
        // If the URL doesn't start with '/' or 'http', add a '/'
        if (!pdfUrl.startsWith('/') && !pdfUrl.startsWith('http')) {
            fullPdfUrl = '/' + pdfUrl;
        }
        
        // If the URL already starts with '/output/', don't change it
        // Otherwise, if it doesn't have the API prefix, add it
        if (!fullPdfUrl.startsWith('/output/') && !fullPdfUrl.startsWith('/api/download/')) {
            fullPdfUrl = `/api/download/${encodeURIComponent(pdfUrl)}`;
        }
    }
    
    console.log(`Opening PDF preview with URL: ${fullPdfUrl}`);
    
    // Check if pdfjsLib is available
    if (typeof pdfjsLib !== 'undefined') {
        // Set worker source
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        
        // Load the PDF document
        pdfjsLib.getDocument(fullPdfUrl).promise
            .then(pdfDoc => {
                // Load the first page
                return pdfDoc.getPage(1);
            })
            .then(page => {
                const canvas = document.createElement('canvas');
                previewContainer.innerHTML = '';
                previewContainer.appendChild(canvas);
                
                const viewport = page.getViewport({ scale: 1.5 });
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                
                const renderContext = {
                    canvasContext: canvas.getContext('2d'),
                    viewport: viewport
                };
                
                // Render the page
                page.render(renderContext);
            })
            .catch(error => {
                console.error('Error loading PDF:', error);
                previewContainer.innerHTML = `
                    <div style="text-align: center;">
                        <i class="fas fa-exclamation-circle" style="font-size: 3rem; color: var(--error-color); margin-bottom: 20px;"></i>
                        <h3>Preview Error</h3>
                        <p>Unable to load PDF preview. You can still download the file.</p>
                        <p>Error details: ${error.message}</p>
                    </div>
                `;
            });
    } else {
        // Fallback when PDF.js is not available
        previewContainer.innerHTML = `
            <div style="text-align: center;">
                <i class="fas fa-file-pdf" style="font-size: 5rem; color: var(--primary-color); margin-bottom: 20px;"></i>
                <h3>PDF Preview</h3>
                <p>PDF preview is not available. You can download the file to view it.</p>
            </div>
        `;
    }
    
    // Set the download button's PDF filename
    downloadPreviewBtn.setAttribute('data-pdf-url', pdfUrl);
    downloadPreviewBtn.setAttribute('data-pdf-name', pdfUrl.split('/').pop());
    
    // Add event listener to the download button
    downloadPreviewBtn.addEventListener('click', () => {
        downloadPdf(pdfUrl, pdfUrl.split('/').pop());
    });
}

// Function to download a PDF file
function downloadPdf(pdfUrl, pdfName) {
    // For debugging - log the download request
    console.log(`Attempting to download: ${pdfUrl} as ${pdfName}`);
    
    // Special case for test_output.pdf
    if (pdfName === 'test_output.pdf' || pdfUrl.includes('test_output.pdf')) {
        console.log('Using direct output path for test file');
        const directUrl = '/output/test_output.pdf';
        
        // Create and click a download link
        const downloadLink = document.createElement('a');
        downloadLink.href = directUrl;
        downloadLink.download = pdfName;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        showToast('Debug file download started', 'success');
        return;
    }
    
    // Show loading toast
    showToast('Starting download...', 'info');
    
    // Determine the correct URL for the PDF
    let fullPdfUrl = pdfUrl;
    
    // If the URL doesn't start with '/' or 'http', add a '/'
    if (!pdfUrl.startsWith('/') && !pdfUrl.startsWith('http')) {
        fullPdfUrl = '/' + pdfUrl;
    }
    
    // If the URL already starts with '/output/', don't change it
    // Otherwise, if it doesn't have the API prefix, add it
    if (!fullPdfUrl.startsWith('/output/') && !fullPdfUrl.startsWith('/api/download/')) {
        fullPdfUrl = `/api/download/${encodeURIComponent(pdfUrl)}`;
    }
    
    console.log(`Full download URL: ${fullPdfUrl}`);
    
    // Set up error handling for download
    let downloadTimer = setTimeout(() => {
        showToast('Download timeout. Please try again.', 'error');
    }, 30000); // 30 second timeout
    
    // Create a fetch request to ensure the file exists before downloading
    fetch(fullPdfUrl, { method: 'HEAD' })
        .then(response => {
            clearTimeout(downloadTimer);
            
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            
            // File exists, trigger download
            const downloadLink = document.createElement('a');
            downloadLink.href = fullPdfUrl;
            downloadLink.download = pdfName;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
            showToast('Download started successfully', 'success');
        })
        .catch(error => {
            clearTimeout(downloadTimer);
            console.error('Download error:', error);
            
            // Try direct output path as fallback
            try {
                console.log('Trying direct output path...');
                const outputUrl = `/output/${pdfName}`;
                const downloadLink = document.createElement('a');
                downloadLink.href = outputUrl;
                downloadLink.download = pdfName;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                
                showToast('Trying alternative download method...', 'warning');
            } catch (directError) {
                showToast(`Download failed. Please try again later.`, 'error');
                console.error('Direct path error:', directError);
            }
        });
}

// Helper function to format file size
function formatFileSize(bytes) {
    if (bytes < 1024) {
        return bytes + ' bytes';
    } else if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + ' KB';
    } else {
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
}

// Add toast notification system for professional error/success messages
let toastTimeout;

function showToast(message, type = 'info') {
    // Clear any existing toast
    clearTimeout(toastTimeout);
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // Create new toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Set icon based on type
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';
    
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas fa-${icon} toast-icon"></i>
            <p>${message}</p>
        </div>
        <button class="toast-close"><i class="fas fa-times"></i></button>
    `;
    
    // Add to document
    document.body.appendChild(toast);
    
    // Show toast with animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Add close button functionality
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    });
    
    // Auto dismiss after 5 seconds
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 5000);
} 