"use strict";

document.addEventListener('DOMContentLoaded', function() {
    const simplifyPage = document.getElementById('simplify_page');
    const showStorage = document.getElementById('show_storage');
    const saveToStorage = document.getElementById('save_to_storage');

    simplifyPage.addEventListener('click', function() {
        chrome.runtime.sendMessage({
            action: 'simplify_page'
        });
    });

    showStorage.addEventListener('click', function() {
        chrome.tabs.create({
            url: 'html/main.html'
        });
    });

    saveToStorage.addEventListener('click', function() {
        chrome.runtime.sendMessage({
            action: 'save_to_storage'
        });
    });
});
