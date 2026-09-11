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
      sort: "default",
      preview: false,
      catalogCollapsed: false,
      prefetchCache: {},
      prefetchInFlight: {},
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

  function discountProgress(builder, runningTotal) {
    var discount = builder.discount;
    if (!discount) return null;
    var threshold = Number(discount.thresholdAmount);
    var percentage = Number(discount.discountPercentage);
    if (!(threshold > 0) || !(percentage > 0)) return null;
    var currencyCode = runningTotal ? runningTotal.currencyCode : "USD";
    var current = runningTotal ? Number(runningTotal.amount) : 0;
    var reached = current >= threshold;
    var percentToThreshold = Math.max(0, Math.min(100, (current / threshold) * 100));
    return {
      label: discount.label,
      percentage: percentage,
      reached: reached,
      percentToThreshold: percentToThreshold,
      remaining: { amount: Math.max(0, threshold - current).toFixed(2), currencyCode: currencyCode },
    };
  }

  function discountBarMarkup(builder, runningTotal) {
    var progress = discountProgress(builder, runningTotal);
    if (!progress) return "";
    var message = progress.reached
      ? (progress.label ? escapeHtml(progress.label) + " unlocked — " : "") + progress.percentage + "% off applied at checkout"
      : "Spend " + money(progress.remaining) + " more to unlock " + progress.percentage + "% off";
    return (
      '<div class="pc-builder-discount-bar' + (progress.reached ? " is-reached" : "") + '" role="status">' +
      '<div class="pc-builder-discount-bar__track"><div class="pc-builder-discount-bar__fill" style="width:' + progress.percentToThreshold + '%"></div></div>' +
      '<span class="pc-builder-discount-bar__label">' + message + "</span>" +
      "</div>"
    );
  }

  function discountLabel(builder, runningTotal) {
    var progress = discountProgress(builder, runningTotal);
    if (!progress) return "None";
    return progress.reached ? progress.percentage + "% applied" : "Not yet unlocked";
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

  function sortedProducts(products, sort) {
    var result = products.slice();
    if (sort === "price-asc") {
      return result.sort(function (left, right) { return Number(left.price.amount) - Number(right.price.amount); });
    }
    if (sort === "price-desc") {
      return result.sort(function (left, right) { return Number(right.price.amount) - Number(left.price.amount); });
    }
    if (sort === "name") {
      return result.sort(function (left, right) {
        return String(left.productTitle).localeCompare(String(right.productTitle));
      });
    }
    return result;
  }

  function selectedProduct(step, state) {
    var selection = state.selections[step.publicId];
    if (!selection) return null;
    return step.products.find(function (product) { return product.variantId === selection.variantId; }) || null;
  }

  function selectedCount(state) {
    return Object.keys(state.selections).length;
  }

  function specificationValue(value) {
    if (Array.isArray(value)) return value.join(", ");
    if (value && typeof value === "object") return Object.keys(value).map(function (key) {
      return key + ": " + value[key];
    }).join(", ");
    return String(value);
  }

  function specificationMarkup(product) {
    if (!product || !product.specifications) return "";
    var entries = Object.keys(product.specifications).filter(function (key) {
      var value = product.specifications[key];
      return value !== undefined && value !== null && value !== "";
    }).slice(0, 4);
    if (!entries.length) return "";
    return '<div class="pc-builder-specs" aria-label="Product specifications">' + entries.map(function (key) {
      return '<div class="pc-builder-spec"><span>' + escapeHtml(key.replace(/[-_]/g, " ")) + '</span><strong>' + escapeHtml(specificationValue(product.specifications[key])) + '</strong></div>';
    }).join("") + "</div>";
  }

  function visualMarkup(step, state) {
    var product = selectedProduct(step, state);
    if (product && product.image) {
      return '<img class="pc-builder-visual__image" src="' + escapeHtml(product.image.url) + '" alt="' + escapeHtml(product.image.altText || product.productTitle) + '">';
    }
    return '<div class="pc-builder-visual__placeholder" aria-hidden="true"><span class="pc-builder-monitor"><span></span></span><span class="pc-builder-visual__hint">Select a component to preview it</span></div>';
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
      if (left === undefined || left === null || left === "" || right === undefined || right === null || right === "") {
        // Do not show a candidate when an active compatibility rule cannot be verified.
        // Missing metadata must be completed in the admin specification workflow.
        if (source === candidate || target === candidate) {
          reasons.push("Required compatibility specifications are missing.");
        }
        return;
      }
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

  function submissionKey(step) {
    return "step-" + step.position + "-" + String(step.name || "")
      .trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function render(root, data, state) {
    var builder = data.builder;
    var steps = builder.steps;
    if (!steps.length) {
      root.innerHTML = '<div class="pc-builder-empty">This builder has no available steps.</div>';
      return;
    }

    var step = steps[state.currentStep] || steps[0];
    state.currentStep = steps.indexOf(step);
    if (state.preview) {
      root.innerHTML = summaryMarkup(builder, steps, state, total(state.selections));
      bind(root, data, state);
      return;
    }

    var showTitle = root.dataset.showTitle !== "false";
    var showDescription = root.dataset.showDescription !== "false";
    var products = sortedProducts(filteredProducts(step.products, state.search), state.sort);
    var runningTotal = total(state.selections);

    root.innerHTML =
      '<div class="pc-builder-shell pc-builder-shell--editor' + (state.catalogCollapsed ? " is-catalog-collapsed" : "") + '">' +
      '<header class="pc-builder-topbar">' +
      '<button class="pc-builder-button pc-builder-button--exit" type="button" data-exit><span aria-hidden="true">&larr;</span> EXIT</button>' +
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
      '<button class="pc-builder-button pc-builder-button--preview" type="button" data-preview>PREVIEW</button>' +
      "</header>" +
      '<div class="pc-builder-workspace">' +
      '<section class="pc-builder-visual-panel" aria-label="Selected component preview">' +
      (showTitle ? '<h2 class="pc-builder-title">' + escapeHtml(builder.name) + "</h2>" : "") +
      (showDescription && builder.description ? '<p class="pc-builder-description">' + escapeHtml(builder.description) + "</p>" : "") +
      '<div class="pc-builder-current-step"><strong>' + escapeHtml(step.name) + '</strong><span>' + (step.required ? "Required selection" : "Optional selection") + '</span></div>' +
      '<div class="pc-builder-visual">' + visualMarkup(step, state) + "</div>" +
      specificationMarkup(selectedProduct(step, state)) +
      "</section>" +
      '<button class="pc-builder-collapse" type="button" data-toggle-products aria-controls="pc-builder-catalog" aria-expanded="' + (!state.catalogCollapsed) + '" aria-label="' + (state.catalogCollapsed ? "Show product catalog" : "Hide product catalog") + '" title="' + (state.catalogCollapsed ? "Show product catalog" : "Hide product catalog") + '"><span aria-hidden="true">' + (state.catalogCollapsed ? "&rsaquo;" : "&lsaquo;") + '</span></button>' +
      '<section class="pc-builder-catalog" id="pc-builder-catalog" aria-label="Available products">' +
      '<div class="pc-builder-catalog-toolbar">' +
      '<label class="pc-builder-search-label">Search ' + escapeHtml(step.name) + ' models<input class="pc-builder-search" data-search type="search" value="' + escapeHtml(state.search) + '" autocomplete="off"></label>' +
      '<label class="pc-builder-sort-label"><span class="pc-builder-visually-hidden">Sort products</span><select class="pc-builder-sort" data-sort>' +
      '<option value="default" ' + (state.sort === "default" ? "selected" : "") + '>Default Sort</option>' +
      '<option value="price-asc" ' + (state.sort === "price-asc" ? "selected" : "") + '>Price: Low to High</option>' +
      '<option value="price-desc" ' + (state.sort === "price-desc" ? "selected" : "") + '>Price: High to Low</option>' +
      '<option value="name" ' + (state.sort === "name" ? "selected" : "") + '>Name</option>' +
      '</select></label>' +
      "</div>" +
      (state.notice ? '<div class="pc-builder-notice" role="status">' + escapeHtml(state.notice) + "</div>" : "") +
      productMarkup(step, products, state, steps, data.compatibilityRules) +
      "</section>" +
      "</div>" +
      discountBarMarkup(builder, runningTotal) +
      '<footer class="pc-builder-bottom-bar">' +
      '<div class="pc-builder-build-totals"><strong>BUILD TOTALS</strong><span>' + (runningTotal ? money(runningTotal) : "Not started") + '</span><span>' + selectedCount(state) + ' of ' + steps.length + ' Parts Configured</span><span>Discount: ' + discountLabel(builder, runningTotal) + '</span></div>' +
      '<div class="pc-builder-bottom-actions">' +
      '<button class="pc-builder-button" type="button" data-back ' + (state.currentStep === 0 ? "disabled" : "") + '>BACK</button>' +
      (!step.required ? '<button class="pc-builder-button" type="button" data-skip>SKIP PART</button>' : "") +
      '<button class="pc-builder-button pc-builder-button--primary" type="button" data-next ' + (step.required && !state.selections[step.publicId] ? "disabled" : "") + '>' + (state.currentStep === steps.length - 1 ? "PREVIEW" : "NEXT") + '</button>' +
      "</div>" +
      "</footer>" +
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
          var unavailable = !product.available || product.purchasable === false;
          var availabilityLabel = product.purchasable === false
            ? (product.unavailableReason === "NOT_PUBLISHED" ? "Not available on the Online Store" : "Currently unavailable")
            : (!product.available ? "Out of stock" : "Available");
          return (
            '<button class="pc-builder-product-row' + (selected ? " is-selected" : "") + '" type="button" data-variant-id="' +
            escapeHtml(product.variantId) +
            '" aria-pressed="' +
            selected +
            '" ' +
            (unavailable ? "disabled" : "") +
            ">" +
            (product.image
              ? '<img class="pc-builder-product-row__image" src="' +
                escapeHtml(product.image.url) +
                '" alt="' +
                escapeHtml(product.image.altText || product.productTitle) +
                '" loading="lazy">'
              : '<span class="pc-builder-product-row__fallback" aria-hidden="true">No image</span>') +
            '<span class="pc-builder-product-row__body">' +
            '<strong class="pc-builder-product-row__title">' +
            escapeHtml(product.productTitle) +
            "</strong>" +
            (product.variantTitle ? '<span class="pc-builder-product-row__variant">' + escapeHtml(product.variantTitle) + "</span>" : "") +
            (product.vendor ? '<span class="pc-builder-product-row__vendor">' + escapeHtml(product.vendor) + "</span>" : "") +
            '<span class="pc-builder-product-row__price">' + money(product.price) + "</span>" +
            "</span>" +
            '<span class="pc-builder-product-row__action">' + (selected ? "ADDED" : unavailable ? availabilityLabel : "ADD PART") + "</span></button>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function summaryMarkup(builder, steps, state, runningTotal) {
    var selectedSteps = steps.filter(function (step) { return Boolean(state.selections[step.publicId]); });
    var leadStep = selectedSteps[0] || steps[0];
    return (
      '<div class="pc-builder-shell pc-builder-shell--summary">' +
      '<header class="pc-builder-topbar pc-builder-topbar--summary">' +
      '<button class="pc-builder-button pc-builder-button--exit" type="button" data-exit><span aria-hidden="true">&larr;</span> EXIT</button>' +
      '<div class="pc-builder-summary-heading"><strong>' + escapeHtml(builder.name) + '</strong><span>Selected Components</span></div>' +
      '<button class="pc-builder-button pc-builder-button--preview" type="button" data-edit>EDIT BUILD</button>' +
      "</header>" +
      '<div class="pc-builder-summary-workspace">' +
      '<section class="pc-builder-visual-panel pc-builder-visual-panel--summary" aria-label="Build preview">' +
      '<div class="pc-builder-visual">' + visualMarkup(leadStep, state) + "</div>" +
      '<p class="pc-builder-summary-caption">' + (selectedSteps.length ? escapeHtml(selectedSteps[0].name) + " selected" : "No components selected") + '</p>' +
      "</section>" +
      '<section class="pc-builder-selected-panel" aria-label="Selected components">' +
      '<div class="pc-builder-selected-heading"><h2>Selected Components</h2><span>' + selectedCount(state) + ' items | ' + (runningTotal ? money(runningTotal) : "Not started") + '</span></div>' +
      '<div class="pc-builder-selected-list">' +
      (selectedSteps.length ? selectedSteps.map(function (step) {
        var selection = state.selections[step.publicId];
        var product = selectedProduct(step, state);
        return '<article class="pc-builder-selected-row">' +
          (product && product.image ? '<img class="pc-builder-selected-row__image" src="' + escapeHtml(product.image.url) + '" alt="' + escapeHtml(product.image.altText || product.productTitle) + '">' : '<span class="pc-builder-selected-row__fallback">No image</span>') +
          '<div class="pc-builder-selected-row__body"><span class="pc-builder-selected-row__step">' + escapeHtml(step.name) + '</span><strong>' + escapeHtml(product ? product.productTitle : step.name) + '</strong><span>Quantity: 1</span></div>' +
          '<strong class="pc-builder-selected-row__price">' + money(selection.price) + '</strong>' +
          '</article>';
      }).join("") : '<div class="pc-builder-empty">Select components to see the bundle summary.</div>') +
      "</div>" +
      "</section>" +
      "</div>" +
      discountBarMarkup(builder, runningTotal) +
      '<footer class="pc-builder-bottom-bar pc-builder-bottom-bar--summary">' +
      '<div class="pc-builder-build-totals"><strong>BUILD TOTALS</strong><span>' + (runningTotal ? money(runningTotal) : "Not started") + '</span><span>' + selectedCount(state) + ' Parts Configured</span><span>Discount: ' + discountLabel(builder, runningTotal) + '</span></div>' +
      '<div class="pc-builder-bottom-actions"><button class="pc-builder-button" type="button" data-edit>EDIT BUILD</button><button class="pc-builder-button pc-builder-button--primary" type="button" data-add ' + (selectedCount(state) ? "" : "disabled") + '>ADD TO CART</button></div>' +
      "</footer>" +
      "</div>"
    );
  }

  function bind(root, data, state) {
    root.querySelectorAll("[data-preview]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.preview = true;
        render(root, data, state);
      });
    });
    root.querySelectorAll("[data-edit]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.preview = false;
        render(root, data, state);
      });
    });
    root.querySelectorAll("[data-exit]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (window.history.length > 1) window.history.back();
        else window.location.assign("/");
      });
    });
    root.querySelector("[data-toggle-products]")?.addEventListener("click", function () {
      state.catalogCollapsed = !state.catalogCollapsed;
      render(root, data, state);
    });
    root.querySelectorAll("[data-step-index]").forEach(function (button) {
      button.addEventListener("click", function () {
        var targetIndex = Number(button.dataset.stepIndex);
        if (targetIndex > state.currentStep && Object.keys(state.selections).length) {
          loadStep(root, data, state, targetIndex);
          return;
        }
        state.currentStep = targetIndex;
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
        prefetchNextStep(root, data, state);
      });
    });
    root.querySelector("[data-search]")?.addEventListener("input", function (event) {
      state.search = event.target.value;
      render(root, data, state);
    });
    root.querySelector("[data-sort]")?.addEventListener("change", function (event) {
      state.sort = event.target.value;
      render(root, data, state);
    });
    root.querySelector("[data-back]")?.addEventListener("click", function () {
      state.currentStep = Math.max(0, state.currentStep - 1);
      state.search = "";
      render(root, data, state);
    });
    root.querySelector("[data-next]")?.addEventListener("click", function () {
      if (state.currentStep === data.builder.steps.length - 1) {
        state.preview = true;
        render(root, data, state);
        return;
      }
      loadStep(root, data, state, state.currentStep + 1);
    });
    root.querySelector("[data-skip]")?.addEventListener("click", function () {
      var step = data.builder.steps[state.currentStep];
      if (step.required) return;
      delete state.selections[step.publicId];
      if (state.skippedStepIds.indexOf(step.publicId) === -1) state.skippedStepIds.push(step.publicId);
      if (state.currentStep === data.builder.steps.length - 1) {
        state.preview = true;
        render(root, data, state);
        return;
      }
      state.currentStep = Math.min(data.builder.steps.length - 1, state.currentStep + 1);
      state.search = "";
      render(root, data, state);
    });
    root.querySelector("[data-add]")?.addEventListener("click", function (button) {
      var addButton = button.currentTarget;
      addButton.disabled = true;
      addButton.textContent = "Validating...";
      var payload = {};
      data.builder.steps.forEach(function (step) {
        var selection = state.selections[step.publicId];
        if (selection) payload[submissionKey(step)] = selection.variantId;
      });
      var configuredPath = root.getAttribute("data-proxy-path") || "/apps/pc-builder-1";
      fetch(configuredPath + "/builder", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ builderId: data.builder.publicId, selections: payload, sessionId: state.sessionId }) })
        .then(function (response) { return response.json().then(function (body) { if (!response.ok || !body.valid) throw new Error((body.errors || []).map(function (error) { return error.message; }).join(" ") || "This build could not be validated."); return body; }); })
        .then(function (validated) {
          var bundleParentGid = validated.bundleParentVariantId;
          if (!bundleParentGid) throw new Error("The bundle is temporarily unavailable. Please try again.");
          var discountPercent = validated.discount ? validated.discount.percentage : null;
          var items = validated.selections.map(function (selection) {
            var properties = {
              _pc_builder: data.builder.name,
              _pc_build_session: validated.sessionId,
              _pc_bundle_parent_variant: bundleParentGid,
              _pc_component: selection.stepKey,
              _pc_builder_step: selection.stepId,
            };
            if (discountPercent) properties._pc_discount_percent = String(discountPercent);
            return {
              id: String(gidNumericId(selection.variantId)),
              quantity: 1,
              properties: properties,
            };
          });
          console.info("PC Builder cart payload", {
            builderId: data.builder.publicId,
            sessionId: validated.sessionId,
            selections: validated.selections.map(function (selection) {
              return { stepId: selection.stepId, stepKey: selection.stepKey, variantGid: selection.variantId };
            }),
            items: items.map(function (item) { return { id: item.id, quantity: item.quantity, hasProperties: Boolean(item.properties) }; }),
          });
          console.info("PC Builder cart submit", {
            bundleMode: "dynamic-first-component",
            itemCount: items.length,
            variantIds: items.map(function (item) { return item.id; }),
            quantities: items.map(function (item) { return item.quantity; }),
            bundleParentVariant: bundleParentGid,
          });
          return fetch("/cart/add.js", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ items: items }) })
            .then(function (response) {
              console.info("PC Builder cart response", { status: response.status, ok: response.ok });
              return response;
            })
            .then(function (response) {
              if (response.ok) return response;
              return response.text().then(function (body) {
                console.error("PC Builder cart attempt 1 failed", { status: response.status, responseBody: body, withProperties: true });
                var fallbackItems = items.map(function (item) {
                  return { id: item.id, quantity: item.quantity };
                });
                console.info("PC Builder cart fallback submit", {
                  itemCount: fallbackItems.length,
                  variantIds: fallbackItems.map(function (item) { return item.id; }),
                  quantities: fallbackItems.map(function (item) { return item.quantity; }),
                  withProperties: false,
                });
                return fetch("/cart/add.js", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ items: fallbackItems }) });
              });
            });
        })
        .then(function (response) {
          if (!response.ok) {
            return response.text().then(function (body) {
              var detail = "";
              try { detail = JSON.parse(body).description || JSON.parse(body).message || ""; } catch (_error) { detail = body; }
              console.error("PC Builder cart attempt 2 failed", { status: response.status, responseBody: body, withProperties: false });
              throw new Error("The build was validated, but Shopify could not add it to the cart." + (detail ? " " + detail : ""));
            });
          }
          console.info("PC Builder cart attempt 2 succeeded", { status: response.status, withProperties: false });
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

  function selectionsPayload(state) {
    var payload = {};
    Object.keys(state.selections).forEach(function (key) { payload[key] = state.selections[key].variantId; });
    return payload;
  }

  function selectionsKey(payload) {
    return JSON.stringify(payload);
  }

  function fetchCompatibleProducts(root, data, nextStep, payload) {
    return fetch((root.getAttribute("data-proxy-path") || "/apps/pc-builder-1") + "/builder", {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ action: "compatible_products", builderId: data.builder.publicId, stepKey: nextStep.publicId, selections: payload })
    }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok) throw new Error(body.error || "Could not load compatible products.");
        return body;
      });
    });
  }

  // Silently warms the next step's compatible-product cache as soon as a
  // component is selected, so clicking Next can render instantly instead of
  // waiting on a fetch that starts only at click time.
  function prefetchNextStep(root, data, state) {
    var targetIndex = state.currentStep + 1;
    var nextStep = data.builder.steps[targetIndex];
    if (!nextStep) return;
    var payload = selectionsPayload(state);
    var key = selectionsKey(payload);
    var cached = state.prefetchCache[targetIndex];
    if (cached && cached.key === key) return;
    if (state.prefetchInFlight[targetIndex] === key) return;
    state.prefetchInFlight[targetIndex] = key;
    fetchCompatibleProducts(root, data, nextStep, payload)
      .then(function (body) {
        state.prefetchCache[targetIndex] = { key: key, products: body.products || [] };
      })
      .catch(function () {
        // Swallow silently: loadStep() retries on demand if the shopper clicks Next.
      })
      .then(function () {
        if (state.prefetchInFlight[targetIndex] === key) delete state.prefetchInFlight[targetIndex];
      });
  }

  function loadStep(root, data, state, targetIndex) {
    var nextStep = data.builder.steps[targetIndex];
    if (!nextStep) return;
    var payload = selectionsPayload(state);
    var key = selectionsKey(payload);
    var cached = state.prefetchCache[targetIndex];
    if (cached && cached.key === key) {
      nextStep.products = cached.products;
      state.currentStep = targetIndex;
      state.search = "";
      render(root, data, state);
      return;
    }
    var nextButton = root.querySelector("[data-next]");
    if (nextButton) { nextButton.disabled = true; nextButton.textContent = "Loading..."; }
    fetchCompatibleProducts(root, data, nextStep, payload).then(function (body) {
      nextStep.products = body.products || [];
      state.prefetchCache[targetIndex] = { key: key, products: nextStep.products };
      state.currentStep = targetIndex;
      state.search = "";
      render(root, data, state);
    }).catch(function (error) {
      state.notice = error.message;
      render(root, data, state);
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
    state.notice = "";
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
                error.responseBody = data;
                errors.push(error);
                throw error;
              }
              return data;
            });
        });
      });
    }, Promise.reject(new Error("unavailable"))).catch(function (error) {
      console.error("PC Builder catalog load failed", {
        path: error && error.path ? error.path : null,
        status: error && error.status ? error.status : null,
        message: error && error.message ? error.message : "unavailable",
        responseBody: error && error.responseBody ? error.responseBody : null,
        attemptedPaths: paths,
      });
      throw errors[0] || new Error("unavailable");
    });
  }

  function init(root) {
    fetchBuilder(root)
      .then(function (data) {
        console.info("PC Builder catalog loaded", {
          builderId: data && data.builder ? data.builder.publicId : null,
          steps: data && data.builder ? data.builder.steps.map(function (step) {
            return { name: step.name, state: step.state, productCount: step.products.length };
          }) : [],
        });
        render(root, data, createState(data.builder.publicId));
      })
      .catch(function (error) {
        console.error("PC Builder initialization failed", error);
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
