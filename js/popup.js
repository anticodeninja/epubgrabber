"use strict";

let ctrButtonsBlock, ctrSimplifyPage, ctrShowStorage, ctrSaveToStorage,
    ctrProgressBlock, ctrProgressText;

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

document.addEventListener('DOMContentLoaded', function() {
    ctrButtonsBlock = document.getElementById('buttons-block');
    ctrSimplifyPage = document.getElementById('simplify-page');
    ctrShowStorage = document.getElementById('show-storage');
    ctrSaveToStorage = document.getElementById('save-to-storage');

    ctrProgressBlock = document.getElementById('progress-block');
    ctrProgressText = document.getElementById('progress-text');

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

    setMessage();
});

chrome.runtime.onMessage.addListener(function(message, sender, callback) {
    if (message.action == 'page_saved' || message.action == 'page_simplified') {
        setMessage('\nCompleted.', true);
        setTimeout(function(){
            setMessage();
        }, 1000);
    }
});
