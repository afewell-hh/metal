// ConfigGenerator and switchProfiles are loaded via script tags
class ConfigApp {
    constructor() {
        console.log('Initializing ConfigApp...');
        try {
            this.configGenerator = new ConfigGenerator(switchProfiles);
            console.log('Switch profiles:', switchProfiles);
            this.initializeMermaid();
            this.populateSwitchModels();
            this.setupEventListeners();
            console.log('ConfigApp initialization complete');
        } catch (error) {
            console.error('Error initializing ConfigApp:', error);
        }
    }

    initializeMermaid() {
        console.log('Initializing Mermaid...');
        mermaid.initialize({
            startOnLoad: true,
            theme: 'neutral',
            securityLevel: 'loose',
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true,
                curve: 'basis'
            }
        });
    }

    populateSwitchModels() {
        console.log('Populating switch models...');
        const models = listSwitchModels();
        console.log('Available models:', models);
        
        const leafSelect = document.getElementById('leafModel');
        const spineSelect = document.getElementById('spineModel');
        
        if (!leafSelect || !spineSelect) {
            console.error('Could not find select elements:', { leafSelect, spineSelect });
            return;
        }

        models.forEach(({ model, name }) => {
            console.log('Adding model:', { model, name });
            const option = new Option(name, model);
            leafSelect.add(option.cloneNode(true));
            spineSelect.add(option);
        });
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        const form = document.getElementById('configForm');
        const downloadBtn = document.getElementById('downloadConfig');
        const topologyType = document.getElementById('topologyType');

        if (!form || !downloadBtn || !topologyType) {
            console.error('Could not find required elements:', { form, downloadBtn, topologyType });
            return;
        }

        form.addEventListener('submit', (e) => this.handleSubmit(e));
        downloadBtn.addEventListener('click', () => this.handleDownload());

        // Toggle topology sections
        topologyType.addEventListener('change', (e) => {
            const spineLeafConfig = document.getElementById('spineLeafConfig');
            if (spineLeafConfig) {
                spineLeafConfig.style.display = e.target.value === 'spine-leaf' ? 'block' : 'none';
            }
        });
    }

    async handleSubmit(e) {
        e.preventDefault();
        console.log('Form submitted');

        const formData = {
            leafModel: document.getElementById('leafModel').value,
            spineModel: document.getElementById('spineModel').value,
            leafCount: parseInt(document.getElementById('leafCount').value),
            spineCount: parseInt(document.getElementById('spineCount').value),
            uplinksPerLeaf: parseInt(document.getElementById('uplinksPerLeaf').value),
            totalServerPorts: document.getElementById('totalServerPorts').value
                ? parseInt(document.getElementById('totalServerPorts').value)
                : undefined
        };

        console.log('Form data:', formData);

        try {
            const config = this.configGenerator.generateSpineLeafConfig(formData);
            console.log('Generated config:', config);
            await this.displayResults(config);
        } catch (error) {
            console.error('Error generating config:', error);
            alert(`Configuration Error: ${error.message}`);
        }
    }

    async displayResults(config) {
        console.log('Displaying results...');
        const results = document.getElementById('results');
        if (!results) {
            console.error('Could not find results element');
            return;
        }

        results.classList.remove('hidden');

        try {
            // Display configuration as YAML
            const configOutput = document.getElementById('configOutput');
            if (configOutput) {
                console.log('Generating YAML from manifests:', config.manifests);
                const yamlDocs = config.manifests.map(manifest => {
                    console.log('Converting manifest to YAML:', manifest);
                    return jsyaml.dump(manifest);
                }).join('\n---\n');
                console.log('Generated YAML:', yamlDocs);
                configOutput.textContent = yamlDocs;
            }

            // Render diagrams
            const topologyDiv = document.getElementById('topologyDiagram');
            const cablingDiv = document.getElementById('cablingDiagram');
            
            if (topologyDiv && cablingDiv) {
                console.log('Rendering diagrams with content:', {
                    topology: config.diagrams.topology,
                    cabling: config.diagrams.cabling
                });

                // Clear existing content
                topologyDiv.innerHTML = '';
                cablingDiv.innerHTML = '';
                
                // Create new diagram containers with unique IDs
                const topologyId = 'topology-' + Date.now();
                const cablingId = 'cabling-' + Date.now();
                
                // Insert diagrams
                topologyDiv.innerHTML = `<div class="mermaid">${config.diagrams.topology}</div>`;
                cablingDiv.innerHTML = `<div class="mermaid">${config.diagrams.cabling}</div>`;
                
                // Re-run mermaid
                await mermaid.run();
            }

            // Scroll to results
            results.scrollIntoView({ behavior: 'smooth' });
        } catch (error) {
            console.error('Error displaying results:', error);
            console.error('Error details:', error.stack);
        }
    }

    handleDownload() {
        console.log('Handling download...');
        const configOutput = document.getElementById('configOutput');
        if (!configOutput) {
            console.error('Could not find configOutput element');
            return;
        }

        try {
            const configBlob = new Blob([configOutput.textContent], { type: 'text/yaml' });
            this.downloadFile(configBlob, 'hedgehog-config.yaml');
        } catch (error) {
            console.error('Error handling download:', error);
            console.error('Error details:', error.stack);
        }
    }

    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');
    new ConfigApp();
});
