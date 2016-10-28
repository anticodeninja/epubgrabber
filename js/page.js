"use strict";

function getImage(document, src, callback) {
    let canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d");
    let img = new Image();
    
    img.crossOrigin = "Anonymous";
    img.onload = function() {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        callback(canvas.toDataURL("image/png"));
    }
    img.src = src;
}

function grabPage() {
    let body = document.body.cloneNode(true);
    const images = body.querySelectorAll("img");
    let awaited = images.length;
    let urls = [];

    for (let i = 0; i<images.length; ++i) {
        urls.push(images[i].src);
    }

    chrome.runtime.sendMessage({
        action: "on_cross_origin",
        urls: urls
    });

    for (let i = 0; i<images.length; ++i) {
        let image = images[i];
        getImage(document, images[i].src, function(data){
            image.src = data;
            awaited -= 1;
            
            if (awaited == 0) {
                chrome.runtime.sendMessage({
                    action: "off_cross_origin"
                });
                chrome.runtime.sendMessage({
                    action: "save_page",
                    location: document.location.href,
                    title: document.title,
                    html: body.innerHTML
                });
            }
        });
    }
}

chrome.runtime.onMessage.addListener(function(message, sender, callback) {
    if (message.action == "get_page") {
        grabPage();
    }
});

