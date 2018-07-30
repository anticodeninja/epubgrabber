"use strict";

let currentConfig,
    ctrButtonsBlock, ctrSimplifyPage, ctrShowStorage, ctrSaveToStorage, ctrConfigurePage,
    ctrProgressBlock, ctrProgressText,
    ctrConfigureBlock, ctrConfigureUrl, ctrConfigureTake, ctrConfigureRemove, ctrConfigurePreview, ctrConfigureSave;

function setMessage(message, append) {
    var height;

    ctrButtonsBlock.style.display = message ? 'none' : 'block';
    ctrProgressBlock.style.display = message ? 'block' : 'none';

    if (message) {
        if (append) {
            message = ctrProgressText.innerText + message;
        }
        ctrProgressText.innerText = message;
    }

    height = (message ? ctrProgressBlock : ctrButtonsBlock).clientHeight;
    document.body.style.height = height;
    document.querySelector('html').style.height = height;
}

function previewSimplifyImpl() {
    function createOverlay(element) {
        let overlay = document.createElement('div');
        let clientRect = element.getBoundingClientRect();

        overlay.className = 'epub-preview';
        overlay.style.position = 'absolute';
        overlay.style.top = (window.pageYOffset + clientRect.top) + 'px';
        overlay.style.left = (window.pageXOffset + clientRect.left) + 'px';
        overlay.style.width = clientRect.width + 'px';
        overlay.style.height = clientRect.height + 'px';
        overlay.style.zIndex = 2147483647;

        document.body.appendChild(overlay);
        return overlay;
    }

    {
        let blocks = document.querySelectorAll('.epub-preview');
        for (let j = 0; j < blocks.length; ++j) {
            blocks[j].remove();
        }
    }

    for (let i = 0; i < take.length; ++i) {
        let blocks = document.querySelectorAll(take[i]);
        for (let j = 0; j < blocks.length; ++j) {
            let overlay = createOverlay(blocks[j]);
            overlay.style.backgroundColor = 'rgba(0, 255, 0, 0.3)';
        }
    }

    for (let i = 0; i < remove.length; ++i) {
        let blocks = document.querySelectorAll(remove[i]);
        for (let j = 0; j < blocks.length; ++j) {
            let overlay = createOverlay(blocks[j]);
            overlay.style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    ctrButtonsBlock = document.getElementById('buttons-block');
    ctrSimplifyPage = document.getElementById('simplify-page');
    ctrShowStorage = document.getElementById('show-storage');
    ctrSaveToStorage = document.getElementById('save-to-storage');
    ctrConfigurePage = document.getElementById('configure-page');

    ctrProgressBlock = document.getElementById('progress-block');
    ctrProgressText = document.getElementById('progress-text');

    ctrConfigureBlock = document.getElementById('configure-block');
    ctrConfigureUrl = document.getElementById('configure-url');
    ctrConfigureTake = document.getElementById('configure-take');
    ctrConfigureRemove = document.getElementById('configure-remove');
    ctrConfigurePreview = document.getElementById('configure-preview');
    ctrConfigureSave = document.getElementById('configure-save');

    ctrSimplifyPage.addEventListener('click', function(event) {
        event.preventDefault();
        chrome.runtime.sendMessage({
            action: 'simplify_page'
        });
        setMessage('Simplifying page...');
    });

    ctrShowStorage.addEventListener('click', function(e) {
        event.preventDefault();
        chrome.tabs.create({
            url: 'html/main.html'
        });
    });

    ctrSaveToStorage.addEventListener('click', function(event) {
        event.preventDefault();
        chrome.runtime.sendMessage({
            action: 'save_to_storage'
        });
        setMessage('Saving page...');
    });

    ctrConfigurePage.addEventListener('click', function(event) {
        event.preventDefault();
        chromep.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
            ctrConfigureBlock.style.display = 'block';
            ctrButtonsBlock.style.display = 'none';

            return getPageSettings(tabs[0].url);
        }).then((config) => {
            currentConfig = config;
            ctrConfigureUrl.value = config.url;
            ctrConfigureTake.value = config.take;
            ctrConfigureRemove.value = config.remove;
        });
    });

    ctrConfigurePreview.addEventListener('click', function(event) {
        event.preventDefault();
        chromep.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
            let script = '(function() {\n';
            script += 'var take = ' + JSON.stringify(splitFilter(ctrConfigureTake.value)) + ',\n';
            script += '    remove = ' + JSON.stringify(splitFilter(ctrConfigureRemove.value)) + ';\n';
            script += '(' + previewSimplifyImpl.toString() + ')();\n';
            script += '})();';

            return chromep.tabs.executeScript(tabs[0].id, { code: script });
        });
    });

    ctrConfigureSave.addEventListener('click', function(event) {
        event.preventDefault();
        ctrConfigureBlock.style.display = 'none';
        ctrButtonsBlock.style.display = 'block';

        currentConfig.url = ctrConfigureUrl.value;
        currentConfig.take = ctrConfigureTake.value;
        currentConfig.remove = ctrConfigureRemove.value;

        setPageSettings(currentConfig);
    });

    ctrConfigureBlock.style.display = 'none';
    setMessage();
});

chrome.runtime.onMessage.addListener(function(message, sender, callback) {
    if (message.action == 'page_simplified' || message.action == 'page_saved') {
        if (!message.result) {
            setMessage('\nCompleted.', true);
            setTimeout(function(){
                setMessage();
            }, 1000);
        } else {
            setMessage('Error: ' + message.result, false);
        }
    }
});
