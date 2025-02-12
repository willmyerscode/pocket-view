class PocketView {
  static pluginTitle = "wmPocketView";
  static defaultSettings = {
    buttonDisplay: "title",
    startView: 1,
    contentDisplay: "title, description",
    interactionType: "click",
    autoTiming: false,
    stopOnInteraction: true,
    presetStyle: "",
    presetContent: "one",
    mobileLayout: "accordion",
    buttonTitleTag: "h4",
    contentTitleTag: "h2",
  };
  static get userSettings() {
    return window["wmPocketView"] || {};
  }
  constructor(el) {
    this.el = el;
    this.source = el.dataset.source;
    this.loadingState = "building";

    this.settings = this.deepMerge(
      {},
      PocketView.defaultSettings,
      PocketView.userSettings,
      this.instanceSettings
    );

    this.activeIndex = this.settings.startView - 1;

    this.init();
  }
  async init() {
    const self = this;
    this.emitEvent("wmPocketView:beforeInit", self);
    this.data = await this.getData(this.source);
    this.buildStructure();

    if (this.settings.autoTiming) {
      this.setupAutoplay();
    }
    this.loadingState = "built";
    this.emitEvent("wmPocketView:afterInit", self);
  }

  async getData(url) {
    try {
      // Fetch the content from the URL
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      const data = [];
      const selector =
        ".page-section .user-items-list-item-container[data-current-context]";

      // Parse the HTML and extract content based on the selector
      // Create a new DOM parser
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const listSection = doc.querySelectorAll(selector);
      listSection.forEach(section => {
        const json = JSON.parse(section.dataset.currentContext);
        data.push(json);
      });

      // Return the outer HTML of the selected element or an empty string if not found
      return data;
    } catch (error) {
      console.error("Error fetching URL:", error);
      return "";
    }
  }
  deepMerge(...objs) {
    function getType(obj) {
      return Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
    }
    function mergeObj(clone, obj) {
      for (let [key, value] of Object.entries(obj)) {
        let type = getType(value);
        if (type === "object" || type === "array") {
          if (clone[key] === undefined) {
            clone[key] = type === "object" ? {} : [];
          }
          mergeObj(clone[key], value); // Corrected recursive call
        } else if (type === "function") {
          clone[key] = value; // Directly reference the function
        } else {
          clone[key] = value;
        }
      }
    }
    if (objs.length === 0) {
      return {};
    }
    let clone = {};
    objs.forEach(obj => {
      mergeObj(clone, obj);
    });
    return clone;
  }

  setActiveView(index) {
    this.activeIndex = index;

    if (this.autoplay && this.autoplay.enabled) {
      clearInterval(this.autoplay.interval);
      const timing = this.autoplay.timing;
      const advance = this.autoplay.advance;
      this.autoplay.interval = setInterval(advance, timing);
    }

    //Remove Classes
    this.buttons.forEach(btn => btn.classList.remove("active"));
    this.accordionButtons.forEach(btn => btn.classList.remove("active"));
    this.contentItems.forEach(item => item.classList.remove("active"));
    this.accordionItems.forEach(item => item.classList.remove("active"));

    //Add Classes
    this.buttons[index].classList.add("active");
    this.accordionButtons[index].classList.add("active");
    this.contentItems[index].classList.add("active");
    this.accordionItems[index].classList.add("active");

    if (
      window.innerWidth <= 766 &&
      this.settings.mobileLayout === "scroll"
    ) {
      this.buttons[index].scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }

  goToNextView() {
    if (this.activeIndex < this.buttons.length - 1) {
      this.setActiveView(this.activeIndex + 1);
    } else {
      this.setActiveView(0);
    }
  }

  goToPreviousView() {
    if (this.activeIndex > 0) {
      this.setActiveView(this.activeIndex - 1);
    } else {
      this.setActiveView(this.buttons.length - 1);
    }
  }

  buildStructure() {
    this.listSectionData = this.data[0];

    const listSectionItems = this.listSectionData.userItems;

    this.getSectionOptions();

    this.componentWrapper = document.createElement("div");
    this.componentWrapper.classList.add("pocket-view-wrapper");

    this.mobileContainer = document.createElement("div");
    this.mobileContainer.classList.add("pocket-accordion");
    this.el.append(this.mobileContainer);

    this.buttonContainer = document.createElement("div");
    this.buttonContainer.classList.add("button-container");

    this.buttonWrapper = document.createElement("div");
    this.buttonWrapper.classList.add("button-list-wrapper");

    this.contentContainer = document.createElement("div");
    this.contentContainer.classList.add("pocket-content-container");

    this.contentWrapper = document.createElement("div");
    this.contentWrapper.classList.add("pocket-content-wrapper");

    this.buttonContainer.append(this.buttonWrapper);
    this.componentWrapper.append(this.buttonContainer);
    this.contentContainer.append(this.contentWrapper);
    this.componentWrapper.append(this.contentContainer);

    this.el.append(this.componentWrapper);

    listSectionItems.forEach(item => {
      const accordionItem = document.createElement("div");
      accordionItem.classList.add("pocket-accordion-item");
      this.mobileContainer.append(accordionItem);

      this.buildButton(item, accordionItem);
      this.buildContentPanel(item, accordionItem);
    });

    this.contentItems = this.el.querySelectorAll(
      ".pocket-view-wrapper .content-item"
    );
    this.accordionItems = this.el.querySelectorAll(
      ".pocket-accordion .content-item"
    );

    this.buttons = this.el.querySelectorAll(
      ".pocket-view-wrapper .pocket-button"
    );
    this.accordionButtons = this.el.querySelectorAll(
      ".pocket-accordion .pocket-button"
    );

    this.setInitialState();
    this.setHeights();
    this.watchInteraction();
  }

  getSectionOptions() {
    this.buttonEnabled = this.listSectionData.options.isButtonEnabled;
    this.descriptionEnabled = this.listSectionData.options.isBodyEnabled;
    this.titleEnabled = this.listSectionData.options.isTitleEnabled;
    this.imageEnabled = this.listSectionData.options.isMediaEnabled;
  }

  buildButton(item, accordionItem) {
    let button = document.createElement("button");
    button.classList.add("pocket-button");

    let presetContent = this.settings.presetContent;

    if (this.settings.presetContent === "one") {
      let buttonText = document.createElement(
        `${this.settings.buttonTitleTag}`
      );
      buttonText.classList.add("button-text");
      buttonText.innerText = item.title;

      button.append(buttonText);

      let buttonDescription = document.createElement("div");
      buttonDescription.classList.add("button-description");
      buttonDescription.innerHTML = item.description;

      button.append(buttonDescription);
    }

    if (this.settings.presetContent === "two") {
      let buttonText = document.createElement(
        `${this.settings.buttonTitleTag}`
      );
      buttonText.classList.add("button-text");
      buttonText.innerText = item.title;

      button.append(buttonText);
    }

    if (this.settings.presetContent === "three") {
      let buttonText = document.createElement(
        `${this.settings.buttonTitleTag}`
      );
      buttonText.classList.add("button-text");
      buttonText.innerText = item.title;

      let buttonImage = document.createElement("img");
      buttonImage.classList.add("pocket-button-image");
      buttonImage.src = item.image.assetUrl;

      button.append(buttonImage);
      button.append(buttonText);
      button.classList.add("image-button");
    }

    this.buttonWrapper.append(button);

    const cloneButton = button.cloneNode(true);
    accordionItem.append(cloneButton);
  }

  buildContentPanel(item, accordionItem) {
    let contentItem = document.createElement("div");
    contentItem.classList.add("content-item");

    let presetContent = this.settings.presetContent;

    if (presetContent === "two") {
      let contentDescription = document.createElement("div");
      contentDescription.classList.add("content-description");

      let description = item.description;

      console.log(item.description);

      // Step 1: Remove the outer p tags while preserving content
      description = description.replace(
        /^<p data-rte-preserve-empty="true" style="white-space:pre-wrap;">([\s\S]*)<\/p>$/,
        '$1'
      );

      // Step 2: Convert encoded HTML tags to actual elements
      description = description
        .replace(/&lt;h1&gt;(.*?)&lt;\/h1&gt;/g, "<h1>$1</h1>")
        .replace(/&lt;h2&gt;(.*?)&lt;\/h2&gt;/g, "<h2>$1</h2>")
        .replace(/&lt;h3&gt;(.*?)&lt;\/h3&gt;/g, "<h3>$1</h3>")
        .replace(/&lt;h4&gt;(.*?)&lt;\/h4&gt;/g, "<h4>$1</h4>");

      // Step 3: Handle links with heading markers
      description = description
        .replace(
          /<a[^>]*href=["']([^#"']+)#h1["'][^>]*>(.*?)<\/a>/g,
          '<h1><a href="$1">$2</a></h1>'
        )
        .replace(
          /<a[^>]*href=["']([^#"']+)#h2["'][^>]*>(.*?)<\/a>/g,
          '<h2><a href="$1">$2</a></h2>'
        )
        .replace(
          /<a[^>]*href=["']([^#"']+)#h3["'][^>]*>(.*?)<\/a>/g,
          '<h3><a href="$1">$2</a></h3>'
        )
        .replace(
          /<a[^>]*href=["']([^#"']+)#h4["'][^>]*>(.*?)<\/a>/g,
          '<h4><a href="$1">$2</a></h4>'
        )
        .replace(/<a[^>]*href=["']#h1["'][^>]*>(.*?)<\/a>/g, "<h1>$1</h1>")
        .replace(/<a[^>]*href=["']#h2["'][^>]*>(.*?)<\/a>/g, "<h2>$1</h2>")
        .replace(/<a[^>]*href=["']#h3["'][^>]*>(.*?)<\/a>/g, "<h3>$1</h3>")
        .replace(/<a[^>]*href=["']#h4["'][^>]*>(.*?)<\/a>/g, "<h4>$1</h4>");

      // Step 4: Split content into segments based on HTML tags
      let segments = description.split(/(<\/?(?:h[1-4]|a)[^>]*>)/);

      // Step 5: Process segments and wrap plain text in <p> tags
      let processedContent = "";
      let currentText = "";

      segments.forEach(segment => {
        if (segment.trim()) {
          if (segment.startsWith("<")) {
            // If we have accumulated text, wrap it in <p> tags before adding the HTML element
            if (currentText.trim()) {
              processedContent += `<p>${currentText.trim()}</p>`;
              currentText = "";
            }
            processedContent += segment;
          } else {
            currentText += " " + segment;
          }
        }
      });

      // Add any remaining text
      if (currentText.trim()) {
        processedContent += `<p>${currentText.trim()}</p>`;
      }

      if (this.buttonEnabled == true) {
        this.button = document.createElement("div");
        this.button.classList.add("list-item-content__button-container");

        this.buttonLink = document.createElement("a");
        this.buttonLink.classList.add(
          "list-item-content__button",
          "sqs-block-button-element",
          "sqs-block-button-element--medium",
          "sqs-button-element--primary"
        );

        this.buttonLink.innerText = item.button.buttonText;
        this.buttonLink.href = item.button.buttonLink;

        this.button.append(this.buttonLink);
      }

      contentDescription.innerHTML = processedContent.trim();
      contentItem.append(contentDescription);

      if (this.button) {
        contentItem.append(this.button);
      }
    }

    if (presetContent.includes("one")) {
      let contentImage = document.createElement("img");
      contentImage.classList.add("pocket-content-image");
      contentImage.src = item.image.assetUrl;

      contentItem.append(contentImage);
    }

    if (presetContent.includes("three")) {
      let contentDescription = document.createElement("div");
      contentDescription.classList.add("content-description");

      let description = item.description;

      // Step 1: Remove the outer p tags while preserving content
      description = description.replace(
        /<p data-rte-preserve-empty="true" style="white-space:pre-wrap;">|<\/p>/g,
        "\n"
      );

      // Step 2: Convert encoded HTML tags to actual elements
      description = description
        .replace(/&lt;h1&gt;(.*?)&lt;\/h1&gt;/g, "<h1>$1</h1>")
        .replace(/&lt;h2&gt;(.*?)&lt;\/h2&gt;/g, "<h2>$1</h2>")
        .replace(/&lt;h3&gt;(.*?)&lt;\/h3&gt;/g, "<h3>$1</h3>")
        .replace(/&lt;h4&gt;(.*?)&lt;\/h4&gt;/g, "<h4>$1</h4>");

      // Step 3: Handle links with heading markers
      description = description
        .replace(
          /<a[^>]*href=["']([^#"']+)#h1["'][^>]*>(.*?)<\/a>/g,
          '<h1><a href="$1">$2</a></h1>'
        )
        .replace(
          /<a[^>]*href=["']([^#"']+)#h2["'][^>]*>(.*?)<\/a>/g,
          '<h2><a href="$1">$2</a></h2>'
        )
        .replace(
          /<a[^>]*href=["']([^#"']+)#h3["'][^>]*>(.*?)<\/a>/g,
          '<h3><a href="$1">$2</a></h3>'
        )
        .replace(
          /<a[^>]*href=["']([^#"']+)#h4["'][^>]*>(.*?)<\/a>/g,
          '<h4><a href="$1">$2</a></h4>'
        )
        .replace(/<a[^>]*href=["']#h1["'][^>]*>(.*?)<\/a>/g, "<h1>$1</h1>")
        .replace(/<a[^>]*href=["']#h2["'][^>]*>(.*?)<\/a>/g, "<h2>$1</h2>")
        .replace(/<a[^>]*href=["']#h3["'][^>]*>(.*?)<\/a>/g, "<h3>$1</h3>")
        .replace(/<a[^>]*href=["']#h4["'][^>]*>(.*?)<\/a>/g, "<h4>$1</h4>");

      // Step 4: Split content into segments based on HTML tags
      let segments = description.split(/(<\/?(?:h[1-4]|a)[^>]*>)/);

      // Step 5: Process segments and wrap plain text in <p> tags
      let processedContent = "";
      let currentText = "";

      segments.forEach(segment => {
        if (segment.trim()) {
          if (segment.startsWith("<")) {
            // If we have accumulated text, wrap it in <p> tags before adding the HTML element
            if (currentText.trim()) {
              processedContent += `<p>${currentText.trim()}</p>`;
              currentText = "";
            }
            processedContent += segment;
          } else {
            currentText += " " + segment;
          }
        }
      });

      // Add any remaining text
      if (currentText.trim()) {
        processedContent += `<p>${currentText.trim()}</p>`;
      }

      if (this.buttonEnabled == true) {
        this.button = document.createElement("div");
        this.button.classList.add("list-item-content__button-container");

        this.buttonLink = document.createElement("a");
        this.buttonLink.classList.add(
          "list-item-content__button",
          "sqs-block-button-element",
          "sqs-block-button-element--medium",
          "sqs-button-element--primary"
        );

        this.buttonLink.innerText = item.button.buttonText;
        this.buttonLink.href = item.button.buttonLink;

        this.button.append(this.buttonLink);
      }

      contentDescription.innerHTML = processedContent.trim();
      contentItem.append(contentDescription);

      if (this.button) {
        contentItem.append(this.button);
      }
    }

    this.contentWrapper.append(contentItem);

    const cloneContent = contentItem.cloneNode(true);
    accordionItem.append(cloneContent);
  }

  setInitialState() {
    const presetStyle = this.settings.presetStyle;
    const mobileLayout = this.settings.mobileLayout;

    this.buttons[0].classList.add("active");
    this.accordionButtons[0].classList.add("active");
    this.contentItems[0].classList.add("active");
    this.accordionItems[0].classList.add("active");

    this.contentItems.forEach((item, index) => {
      const translateX = index === 0 ? 0 : `-${index}00%`;

      item.style.transform = `translateX(${translateX})`;
    });

    if (presetStyle) {
      this.el.dataset.presetStyle = presetStyle;
    }

    this.el.dataset.mobileLayout = this.settings.mobileLayout;
  }

  watchInteraction() {
    let interactionType = this.settings.interactionType;

    if (interactionType.includes("hover")) {
      this.hoverListen();
    } else if (interactionType.includes("click")) {
      this.clickListen();
    }
  }

  hoverListen() {
    this.buttons.forEach((button, index) => {
      button.addEventListener("mouseenter", () => {
        this.setActiveView(index);
      });
    });

    this.accordionButtons.forEach((button, index) => {
      button.addEventListener("mouseenter", () => {
        this.setActiveView(index);
      });
    });
  }

  clickListen() {
    this.buttons.forEach((button, index) => {
      button.addEventListener("click", () => {
        this.setActiveView(index);
      });
    });

    this.accordionButtons.forEach((button, index) => {
      button.addEventListener("click", () => {
        this.setActiveView(index);
      });
    });
  }

  setupAutoplay() {
    this.autoplay = {
      enabled: true,
      interval: null,
      advance: () => {
        if (this.activeIndex < this.buttons.length - 1) {
          this.setActiveView(this.activeIndex + 1);
        } else {
          this.setActiveView(0);
        }
      },
      timing: this.settings.autoTiming,
      stopOnInteraction: this.settings.stopOnInteraction,
    };

    const timing = this.autoplay.timing;
    const advance = this.autoplay.advance;

    this.autoplay.interval = setInterval(advance, timing);

    // Stop autoplay on interaction
    if (this.autoplay.stopOnInteraction) {
      if (this.settings.interactionType.includes("hover")) {
        this.buttons.forEach((button, index) => {
          button.addEventListener("mouseenter", () => {
            console.log("mouseenter");
            clearInterval(this.autoplay.interval);
          });
        });
        this.accordionButtons.forEach((button, index) => {
          button.addEventListener("mouseenter", () => {
            clearInterval(this.autoplay.interval);
          });
        });
      }

      if (this.settings.interactionType.includes("click")) {
        this.buttons.forEach((button, index) => {
          button.addEventListener("click", () => {
            clearInterval(this.autoplay.interval);
          });
        });
        this.accordionButtons.forEach((button, index) => {
          button.addEventListener("click", () => {
            clearInterval(this.autoplay.interval);
          });
        });
      }
    }
  }

  setHeights() {
    const contentWrapper = document.querySelector(".pocket-content-wrapper");
    const contentItems = document.querySelectorAll(
      ".pocket-view-wrapper .content-item"
    );

    let maxHeight = 0;

    contentItems.forEach(item => {
      // Store original display style
      const originalDisplay = item.style.display;

      // Temporarily make item visible but hidden
      item.style.display = "flex";
      item.style.visibility = "hidden";
      item.style.position = "absolute";

      // Get the height including margins
      const computedStyle = window.getComputedStyle(item);
      const marginTop = parseInt(computedStyle.marginTop);
      const marginBottom = parseInt(computedStyle.marginBottom);
      const fullHeight =
        item.getBoundingClientRect().height + marginTop + marginBottom;

      if (fullHeight > maxHeight) {
        maxHeight = fullHeight;
      }

      // Restore original styles
      item.style.display = originalDisplay;
      item.style.visibility = "";
      item.style.position = "";
    });

    // Set the height on the wrapper
    //contentWrapper.style.height = `${maxHeight}px`;
  }

  get instanceSettings() {
    const dataAttributes = {};
    // Function to set value in a nested object based on key path
    const setNestedProperty = (obj, keyPath, value) => {
      const keys = keyPath.split("__");
      let current = obj;

      keys.forEach((key, index) => {
        if (index === keys.length - 1) {
          current[key] = this.parseAttr(value);
        } else {
          current = current[key] = current[key] || {};
        }
      });
    };

    for (let [attrName, value] of Object.entries(this.el.dataset)) {
      setNestedProperty(dataAttributes, attrName, value);
    }
    return dataAttributes;
  }
  parseAttr(string) {
    if (string === "true") return true;
    if (string === "false") return false;
    const number = parseFloat(string);
    if (!isNaN(number) && number.toString() === string) return number;
    return string;
  }
  emitEvent(type, detail = {}, elem = document) {
    // Make sure there's an event type
    if (!type) return;

    // Create a new event
    let event = new CustomEvent(type, {
      bubbles: true,
      cancelable: true,
      detail: detail,
    });

    // Dispatch the event
    return elem.dispatchEvent(event);
  }
}

(() => {
  function initPocketView() {
    const els = document.querySelectorAll(
      '[data-wm-plugin="pocket-view"]:not([data-loading-state])'
    );
    if (!els.length) return;
    els.forEach(el => {
      el.dataset.loadingState = "loading";
      el.wmPocketView = new PocketView(el);
    });
  }
  window.wmPocketView = {
    init: () => initPocketView(),
  };
  window.wmPocketView.init();
})();
