(function () {
  function money(price) {
    var amount = Number(price.amount);
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: price.currencyCode,
      }).format(amount);
    } catch (_error) {
      return amount.toFixed(2) + " " + price.currencyCode;
    }
  }

  function createState(builderId) {
    return {
      builderId: builderId,
      sessionId: "local-" + Date.now().toString(36),
      currentStep: 0,
      selections: {},
      skippedStepIds: [],
      search: "",
      notice: "",
    };
  }

  function total(selections) {
    var values = Object.keys(selections).map(function (key) {
      return selections[key];
    });
    if (!values.length) return null;
    var currencyCode = values[0].price.currencyCode;
    var amount = values.reduce(function (sum, selection) {
      if (selection.price.currencyCode !== currencyCode) return sum;
      return sum + Number(selection.price.amount);
    }, 0);
    return { amount: amount.toFixed(2), currencyCode: currencyCode };
  }

  function filteredProducts(products, query) {
    var normalized = query.trim().toLowerCase();
    if (!normalized) return products;
    return products.filter(function (product) {
      return [
        product.productTitle,
        product.variantTitle || "",
        product.vendor || "",
        product.sku || "",
      ]
        .join(" ")
        .toLowerCase()
        .indexOf(normalized) !== -1;
    });
  }

  function compatibilityFor(step, product, steps, state, rules) {
    var selections = steps.map(function (candidate) {
      var selection = state.selections[candidate.publicId];
      return selection ? { category: normalizeCategory(candidate.key), specifications: selection.specs } : null;
    }).filter(Boolean);
    var candidate = { category: normalizeCategory(step.key), specifications: product.specifications || {} };
    selections.push(candidate);
    var byCategory = {};
    selections.forEach(function (selection) { byCategory[selection.category] = selection; });
    var reasons = [];
    (rules || []).forEach(function (rule) {
      var source = byCategory[normalizeCategory(rule.sourceCategory)];
      var target = byCategory[normalizeCategory(rule.targetCategory)];
      if (!source || !target) return;
      var left = source.specifications[rule.sourceField];
      var right = target.specifications[rule.targetField];
      if (left === undefined || left === null || left === "" || right === undefined || right === null || right === "") return;
      var pass = rule.operator === "EQUALS" ? left === right
        : rule.operator === "IN" ? Array.isArray(right) && right.indexOf(left) !== -1
        : rule.operator === "GREATER_THAN_OR_EQUAL" ? typeof left === "number" && typeof right === "number" && left >= right
        : rule.operator === "LESS_THAN_OR_EQUAL" ? typeof left === "number" && typeof right === "number" && left <= right
        : false;
      if (!pass && rule.severity === "error") reasons.push(rule.message || (rule.sourceCategory + " " + rule.sourceField + " is incompatible with " + rule.targetCategory + " " + rule.targetField + "."));
    });
    return reasons;
  }

  function normalizeCategory(category) {
    var value = String(category || "").trim().toLowerCase();
    var aliases = {
      processor: "cpu",
      processors: "cpu",
      cpu: "cpu",
      memory: "ram",
      ram: "ram",
      graphicscard: "gpu",
      "graphics card": "gpu",
      graphicscards: "gpu",
      gpu: "gpu",
      power: "psu",
      powersupply: "psu",
      "power supply": "psu",
      psu: "psu",
      cooling: "cooler",
      cooler: "cooler",
    };
    return aliases[value.replace(/[-_]/g, "")] || aliases[value] || value;
  }

  function render(root, data, state) {
    var builder = data.builder;
    var steps = builder.steps;
    var step = steps[state.currentStep];
    if (!steps.length) {
      root.innerHTML = '<div class="pc-builder-empty">This builder has no available steps.</div>';
      return;
    }

    var showTitle = root.dataset.showTitle !== "false";
    var showDescription = root.dataset.showDescription !== "false";
    var products = filteredProducts(step.products, state.search);
    var runningTotal = total(state.selections);

    root.innerHTML =
      '<div class="pc-builder-shell">' +
      '<header class="pc-builder-header">' +
      '<div>' +
      (showTitle ? '<h2 class="pc-builder-title">' + escapeHtml(builder.name) + "</h2>" : "") +
      (showDescription && builder.description
        ? '<p class="pc-builder-description">' + escapeHtml(builder.description) + "</p>"
        : "") +
      "</div>" +
      '<div class="pc-builder-muted">Step ' + (state.currentStep + 1) + " of " + steps.length + "</div>" +
      "</header>" +
      '<nav class="pc-builder-steps" aria-label="Builder steps">' +
      steps
        .map(function (candidate, index) {
          return (
            '<button class="pc-builder-step-tab" type="button" data-step-index="' +
            index +
            '" aria-current="' +
            (index === state.currentStep ? "step" : "false") +
            '">' +
            escapeHtml(candidate.name) +
            "</button>"
          );
        })
        .join("") +
      "</nav>" +
      '<div class="pc-builder-layout">' +
      (state.notice ? '<div class="pc-builder-empty pc-builder-notice" role="status">' + escapeHtml(state.notice) + "</div>" : "") +
      '<main class="pc-builder-main">' +
      '<div class="pc-builder-toolbar">' +
      '<div><h3 class="pc-builder-active-title">' +
      escapeHtml(step.name) +
      "</h3>" +
      '<p class="pc-builder-muted">' +
      (step.required ? "Required selection" : "Optional selection") +
      "</p></div>" +
      '<label>Search <input class="pc-builder-search" data-search type="search" value="' +
      escapeHtml(state.search) +
      '" autocomplete="off"></label>' +
      "</div>" +
      productMarkup(step, products, state, steps, data.compatibilityRules) +
      '<div class="pc-builder-actions">' +
      '<button class="pc-builder-button" type="button" data-back ' +
      (state.currentStep === 0 ? "disabled" : "") +
      ">Back</button>" +
      (!step.required
        ? '<button class="pc-builder-button" type="button" data-skip>Skip</button>'
        : "") +
      '<button class="pc-builder-button pc-builder-button--primary" type="button" data-next ' +
      (step.required && !state.selections[step.publicId] ? "disabled" : "") +
      ">Next</button>" +
      "</div>" +
      "</main>" +
      summaryMarkup(steps, state, runningTotal) +
      "</div>" +
      "</div>";

    bind(root, data, state);
  }

  function productMarkup(step, products, state, steps, rules) {
    if (step.state === "no_collection") {
      return '<div class="pc-builder-empty">This step is not connected to a collection yet.</div>';
    }
    if (step.state === "collection_unavailable") {
      return '<div class="pc-builder-empty">Products for this step are temporarily unavailable.</div>';
    }
    var compatibleProducts = products.filter(function (product) {
      return compatibilityFor(step, product, steps, state, rules).length === 0;
    });
    if (!compatibleProducts.length) {
      return '<div class="pc-builder-empty">No matching products are available for this step.</div>';
    }
    return (
      '<div class="pc-builder-products">' +
      compatibleProducts
        .map(function (product) {
          var selected = state.selections[step.publicId]?.variantId === product.variantId;
          var reasons = compatibilityFor(step, product, steps, state, rules);
          var incompatible = reasons.length > 0;
          return (
            '<button class="pc-builder-card" type="button" data-variant-id="' +
            escapeHtml(product.variantId) +
            '" aria-pressed="' +
            selected +
            '" ' +
            ((!product.available || incompatible) ? "disabled" : "") +
            ">" +
            (product.image
              ? '<img class="pc-builder-card__image" src="' +
                escapeHtml(product.image.url) +
                '" alt="' +
                escapeHtml(product.image.altText || product.productTitle) +
                '" loading="lazy">'
              : '<div class="pc-builder-card__fallback" aria-hidden="true">No image</div>') +
            '<span class="pc-builder-card__body">' +
            '<strong class="pc-builder-card__title">' +
            escapeHtml(product.productTitle) +
            "</strong>" +
            (product.variantTitle ? '<span class="pc-builder-muted">' + escapeHtml(product.variantTitle) + "</span>" : "") +
            (product.vendor ? '<span class="pc-builder-muted">' + escapeHtml(product.vendor) + "</span>" : "") +
            '<span class="pc-builder-price">' +
            money(product.price) +
            "</span>" +
            '<span class="pc-builder-muted">' +
            (!product.available ? "Out of stock" : incompatible ? reasons.join(" ") : "Compatible") +
            "</span>" +
            "</span></button>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function summaryMarkup(steps, state, runningTotal) {
    return (
      '<aside class="pc-builder-summary" aria-label="Selected build summary">' +
      "<h3>Selected build</h3>" +
      '<ul class="pc-builder-summary-list">' +
      steps
        .map(function (step) {
          var selection = state.selections[step.publicId];
          return (
            "<li><span>" +
            escapeHtml(step.name) +
            "</span><span>" +
            (selection ? money(selection.price) : "Not selected") +
            "</span></li>"
          );
        })
        .join("") +
      "</ul>" +
      '<div class="pc-builder-total"><span>Total</span><span>' +
      (runningTotal ? money(runningTotal) : "Not started") +
      "</span></div>" +
      '<button class="pc-builder-button pc-builder-button--primary" type="button" data-add ' +
      (Object.keys(state.selections).length ? "" : "disabled") + ">Add build to cart</button>" +
      "</aside>"
    );
  }

  function bind(root, data, state) {
    root.querySelectorAll("[data-step-index]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.currentStep = Number(button.dataset.stepIndex);
        state.search = "";
        render(root, data, state);
      });
    });
    root.querySelectorAll("[data-variant-id]").forEach(function (button) {
      button.addEventListener("click", function () {
        var step = data.builder.steps[state.currentStep];
        var product = step.products.find(function (candidate) {
          return candidate.variantId === button.dataset.variantId;
        });
        if (!product) return;
        state.selections[step.publicId] = {
          productId: product.productId,
          variantId: product.variantId,
          price: product.price,
          specs: product.specifications,
        };
        state.skippedStepIds = state.skippedStepIds.filter(function (id) {
          return id !== step.publicId;
        });
        stepsAfterSelection(data, state);
        render(root, data, state);
      });
    });
    root.querySelector("[data-search]")?.addEventListener("input", function (event) {
      state.search = event.target.value;
      render(root, data, state);
    });
    root.querySelector("[data-back]")?.addEventListener("click", function () {
      state.currentStep = Math.max(0, state.currentStep - 1);
      state.search = "";
      render(root, data, state);
    });
    root.querySelector("[data-next]")?.addEventListener("click", function () {
      state.currentStep = Math.min(data.builder.steps.length - 1, state.currentStep + 1);
      state.search = "";
      render(root, data, state);
    });
    root.querySelector("[data-skip]")?.addEventListener("click", function () {
      var step = data.builder.steps[state.currentStep];
      if (step.required) return;
      delete state.selections[step.publicId];
      if (state.skippedStepIds.indexOf(step.publicId) === -1) state.skippedStepIds.push(step.publicId);
      state.currentStep = Math.min(data.builder.steps.length - 1, state.currentStep + 1);
      state.search = "";
      render(root, data, state);
    });
    root.querySelector("[data-add]")?.addEventListener("click", function (button) {
      var addButton = button.currentTarget;
      addButton.disabled = true;
      addButton.textContent = "Validating...";
      var payload = {};
      Object.keys(state.selections).forEach(function (key) { payload[key] = state.selections[key].variantId; });
      var configuredPath = root.getAttribute("data-proxy-path") || "/apps/pc-builder-1";
      fetch(configuredPath + "/builder", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ builderId: data.builder.publicId, selections: payload, sessionId: state.sessionId }) })
        .then(function (response) { return response.json().then(function (body) { if (!response.ok || !body.valid) throw new Error((body.errors || []).map(function (error) { return error.message; }).join(" ") || "This build could not be validated."); return body; }); })
        .then(function (validated) {
          return fetch("/cart/add.js", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ items: validated.selections.map(function (selection) { return { id: gidNumericId(selection.variantId), quantity: 1, properties: { _pc_builder_id: data.builder.publicId, _pc_build_session: validated.sessionId, _pc_component_type: selection.stepKey, _pc_builder_step_id: selection.stepId } }; }) }) });
        })
        .then(function (response) {
          if (!response.ok) throw new Error("The build was validated, but Shopify could not add it to the cart.");
          return fetch((root.getAttribute("data-proxy-path") || "/apps/pc-builder-1") + "/builder", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ action: "mark_cart_added", sessionId: state.sessionId }) });
        })
        .then(function (response) {
          if (!response.ok) throw new Error("The build was added, but its session could not be recorded.");
          addButton.textContent = "Added to cart";
          window.location.assign("/cart");
        })
        .catch(function (error) { addButton.disabled = false; addButton.textContent = "Add build to cart"; state.notice = error.message; render(root, data, state); });
    });
  }

  function gidNumericId(gid) {
    var match = /^gid:\/\/shopify\/ProductVariant\/(\d+)$/.exec(gid || "");
    if (!match) throw new Error("Invalid Shopify variant.");
    return Number(match[1]);
  }

  function stepsAfterSelection(data, state) {
    var removed = [];
    data.builder.steps.forEach(function (step) {
      var selection = state.selections[step.publicId];
      if (!selection) return;
      var product = step.products.find(function (candidate) { return candidate.variantId === selection.variantId; });
      if (!product || compatibilityFor(step, product, data.builder.steps, state, data.compatibilityRules).length === 0) return;
      delete state.selections[step.publicId];
      removed.push(step.name);
    });
    state.notice = removed.length
      ? "Your " + removed.join(" and ") + " selection was removed because it is no longer compatible."
      : "";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function fetchBuilder(root) {
    var configuredPath = root.getAttribute("data-proxy-path") || "/apps/pc-builder-1";
    var paths = [configuredPath, "/apps/pc-builder-1/builder"].filter(function (path, index, all) {
      return path && all.indexOf(path) === index;
    });
    var errors = [];

    return paths.reduce(function (promise, path) {
      return promise.catch(function () {
        return fetch(path, {
          headers: { Accept: "application/json" },
        }).then(function (response) {
          return response
            .json()
            .catch(function () {
              return {};
            })
            .then(function (data) {
              if (!response.ok) {
                var error = new Error(data.reason || data.error || "unavailable");
                error.status = response.status;
                error.path = path;
                errors.push(error);
                throw error;
              }
              return data;
            });
        });
      });
    }, Promise.reject(new Error("unavailable"))).catch(function () {
      throw errors[0] || new Error("unavailable");
    });
  }

  function init(root) {
    fetchBuilder(root)
      .then(function (data) {
        render(root, data, createState(data.builder.publicId));
      })
      .catch(function (error) {
        var detail = error && error.message ? String(error.message) : "unavailable";
        var status = error && error.status ? "Status " + error.status + ": " : "";
        var path = error && error.path ? " (" + error.path + ")" : "";
        root.innerHTML =
          '<div class="pc-builder-empty"><strong>Builder unavailable</strong><p>This builder is not available right now.</p><p class="pc-builder-muted">' +
          escapeHtml(status + detail + path) +
          '</p><button class="pc-builder-button" type="button" data-retry>Retry</button></div>';
        root.querySelector("[data-retry]")?.addEventListener("click", function () {
          init(root);
        });
      });
  }

  document.querySelectorAll("[data-pc-builder-root]").forEach(init);
})();
