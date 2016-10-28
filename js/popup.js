"use strict";

document.addEventListener('DOMContentLoaded', function() {
    const showSaved = document.getElementById('show_saved');
    const saveToEpub = document.getElementById('save_to_epub');

    showSaved.addEventListener('click', function() {
        chrome.tabs.create({
            url: 'html/main.html'
        });
    });
    
    saveToEpub.addEventListener('click', function() {
        chrome.runtime.sendMessage({
            action: "save_to_epub"
        });
    });
});
