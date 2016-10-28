"use strict";

var responseListener = function(details){
    var flag = false,
	rule = {
	    "name": "Access-Control-Allow-Origin",
	    "value": "*"
	};

    for (let i = 0; i < details.responseHeaders.length; ++i) {
	if (details.responseHeaders[i].name.toLowerCase() === rule.name.toLowerCase()) {
	    flag = true;
	    details.responseHeaders[i].value = rule.value;
	    break;
	}
    }
    
    if (!flag) {
        details.responseHeaders.push(rule);
    }

    return {
        responseHeaders: details.responseHeaders
    };	
};

function saveToEpub() {
    chrome.tabs.getSelected(null, function(tab) {
	chrome.tabs.sendMessage(tab.id, {
            action: "get_page"
        });  
    });
}

chrome.runtime.onMessage.addListener(function(message, sender, callback) {
    if (message.action == "save_to_epub") {
	saveToEpub();
    } else if (message.action == "save_page") {
        chrome.storage.local.get("savedItems", function (data) {
            let savedItems = data.savedItems || {
                counter: 1,
                list: []
            };

            let info = {
                id: savedItems.counter,
                title: message.title,
                location: message.location
            }

            savedItems.list.push(info);
            savedItems.counter += 1;

            let saveData = {}
            saveData["savedItem" + info.id] = message.html;

            chrome.storage.local.set({savedItems: savedItems}, function(){
                console.log("info saved");
            });
            chrome.storage.local.set(saveData, function(){
                console.log("data saved");
            });
        });
        console.log(message);
    } else if (message.action == "on_cross_origin") {
        chrome.webRequest.onHeadersReceived.addListener(responseListener, {
	    urls: message.urls
	},[
            "blocking", "responseHeaders"
        ]);
    } else if (message.action == "off_cross_origin") {
        chrome.webRequest.onHeadersReceived.removeListener(responseListener);
    }
});
