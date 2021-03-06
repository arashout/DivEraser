'use strict';

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message[MSG_KEYS.NAME] === MSG.ERASE_OBJECT) {
        let eraseObj = message[MSG_KEYS.ERASE_OBJECT];
        removeDivs(eraseObj[ERASE_KEYS.CLASS_NAMES], eraseObj[ERASE_KEYS.FILTER_TERMS]);
    }
    else if (message[MSG_KEYS.NAME] === MSG.GET_URL) {
        sendResponse({
            url: getBaseUrl()
        });
    }
    else if (message[MSG_KEYS.NAME] === MSG.PREDICT_CLASS) {
        let predictedClasses = predictItemClassNames();
        sendResponse({
            [RESPONSE_KEYS.PREDICTED_CLASSES] : predictedClasses
        });
    }
});

document.addEventListener("DOMContentLoaded", function () {
    let msg = {
        [MSG_KEYS.NAME]: MSG.DOM_LOADED,
        [MSG_KEYS.CURRENT_URL]: getBaseUrl()
    };

    chrome.runtime.sendMessage(msg, function (response) {
        console.log(response);
    });
});

function removeDivs(arrClassNames, arrFilterTerms) {
    let elements = [];
    for(let i = 0; i < arrClassNames.length; i++){
        let foundElements = document.getElementsByClassName(arrClassNames[i]);
        // For some reason 
        // elements = elements.concat(document.getElementsByClassName(arrClassNames[i]));
        // Wasn't merging properly
        for(let j = 0; j < foundElements.length; j++){
            elements.push(foundElements[j]);
        }
    }

    for (let i = elements.length - 1; 0 <= i; i--) {
        let element = elements[i];
        let stringContent = element.textContent.toLowerCase();
        if (arrFilterTerms.some(function (term) { return stringContent.includes(term); })) {
            element.remove();
        }
    }
}

function getBaseUrl() {
    if (location.origin === 'undefined') {
        location.origin = location.protocol + '//' + location.host;
    }
    return location.origin;
}

/**
 * This method finds the top level list item so 
 * users don't have inspect html to find it themselves 
 */
function predictItemClassNames() {
    let elementInfoDict;
    let htmlElement = document.children[0];

    // Get all elements
    elementInfoDict = recursiveElementExplorer(htmlElement, 0, {});
    // Turn a dictionary into an array of objects (For Filter+Sorting)
    let elementInfoArray = Object.values(elementInfoDict);

    elementInfoArray = elementInfoArray.filter(function (elementInfo) {
        return (
            elementInfo[ELEMENT_INFO.COUNT] > THRESHOLDS.COUNT &&
            elementInfo[ELEMENT_INFO.AVG_TEXT_COUNT] > THRESHOLDS.AVG_TEXT_COUNT
        );
    });

    elementInfoArray = elementInfoArray.sort(function (a, b) {
        return a[ELEMENT_INFO.AVG_TEXT_COUNT] - b[ELEMENT_INFO.AVG_TEXT_COUNT];
    });

    let topNClassNames = [];
    let count = 0;
    for (let i = elementInfoArray.length - 1; i >= 0; i--) {
        count++;
        if(count > THRESHOLDS.TOP_N){break;}
        topNClassNames.push(elementInfoArray[i][ELEMENT_INFO.CLASS_NAME]);
    }
    return topNClassNames;
}

/**
 * A recursive function that fills in information in the document
 * @param {HTMLCollection} element
 * @param {Number} depth 
 * @param {Dictionary} dict
 */
function recursiveElementExplorer(element, depth, dict) {
    fillElementInfo(element, depth, dict);
    //Explore children
    let elChildren = element.children;
    if (elChildren.length === 0) return dict; // No children!


    for (let i = 0; i < elChildren.length; i++) {
        recursiveElementExplorer(elChildren[i], depth + 1, dict);
    }
    return dict;
}

function fillElementInfo(element, depth, dict) {
    // Store information about this element
    let currentClass;
    let generatedId;
    for (let i = 0; i < element.classList.length; i++) {
        currentClass = element.classList[i];
        generatedId = element.tagName + " : " + currentClass + "  : " + depth;

        if (generatedId in dict) {
            let curInfo = dict[generatedId];
            let textCount = element.textContent.length || 0;
            let avg = curInfo[ELEMENT_INFO.AVG_TEXT_COUNT];
            let count = curInfo[ELEMENT_INFO.COUNT];
            let new_avg = (avg * count + textCount) / (count + 1);
            //Set new information
            dict[generatedId][ELEMENT_INFO.AVG_TEXT_COUNT] = new_avg;
            dict[generatedId][ELEMENT_INFO.COUNT] += 1;
        }
        else {
            let textCount = element.textContent.length || 0;
            dict[generatedId] = {
                [ELEMENT_INFO.COUNT]: 1,
                [ELEMENT_INFO.DEPTH]: depth,
                [ELEMENT_INFO.AVG_TEXT_COUNT]: textCount,
                [ELEMENT_INFO.CLASS_NAME]: currentClass,
                [ELEMENT_INFO.GENERATED_ID]: generatedId
            }
        }
    }
}