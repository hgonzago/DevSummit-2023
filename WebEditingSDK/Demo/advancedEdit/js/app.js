require([
    "esri/config",
    "esri/WebMap",
    "esri/views/MapView",
    "esri/widgets/Feature",
    "esri/widgets/FeatureForm",
    "esri/widgets/Home",
    "esri/widgets/Legend",
    "esri/widgets/Search",
    "esri/identity/OAuthInfo",
    "esri/identity/IdentityManager"
  ], function (
    esriConfig, WebMap, MapView, FeatureWidget, FeatureForm, Home, Legend, Search, OAuthInfo, esriId
  ) {

    const oauthInfo = new OAuthInfo({
      appId: "t7L2ThUVWpF1mSRE",
      flowType: "auto", // default that uses two-step flow
      popup: false
    });

    esriId.registerOAuthInfos([oauthInfo]);
    
    const map = new WebMap({
      portalItem: { id: "1f12ca6d13a845ff996d66f832615121" }
    });

    const view = new MapView({
      container: "viewDiv",
      map
    });

    //////////////////////////////////////////////////////
    //  Widget Configuration
    //////////////////////////////////////////////////////

    const formWidget = new FeatureForm({
      view
    }, "form-container");

    const featureWidget = new FeatureWidget({
      visibleElements: { title: false },
      map,
      view
    }, "feature-container");

    const search = new Search({
      popupEnabled: false,
      resultGraphicEnabled: false,
      view
    }, "search-container");

    const legend = new Legend({ view });
    const homeWidget = new Home({ view });

    // Add a 'Home' button below zoom navigation buttons
    view.ui.add(homeWidget, "top-left");
    view.ui.add(legend, "top-right");

    // Disable the default popup
    view.popup.autoOpenEnabled = false;

    //////////////////////////////////////////////////////
    //  App State Logic
    //////////////////////////////////////////////////////

    // Location - Identify an area to search
    search.on("search-complete", () => {
      document.getElementById("location-modal").open = false;
    });

    // Location - Identify a specific streetlamp
    view.on("click", async (evt) => {
      const feature = await getClosestFeature(evt);

      // Streetlamp found; get all attributes before continuing to Step 2
      if (feature) {
        const featureAllAtrributes = await getFullFeature(feature);
        formWidget.feature = featureAllAtrributes;

        document.getElementById("go-to-review-button").disabled = true;
        document.getElementById("details-stepper--review").disabled = true;
        goToStep("details");
      }
    });

    // Details - Update status of the streetlamp
    document.getElementById("go-to-review-button").onclick = (e) => {
      const feature = getUpdatedFeature(formWidget.feature.clone(), formWidget.getValues());

      formWidget.feature = feature;
      featureWidget.graphic = feature;
      goToStep("review");
    };

    // Review - Inspect changes 
    document.getElementById("submit-button").onclick = () => {
      document.getElementById("review-content-wrapper").hidden = true;
      document.getElementById("submit-loader").hidden = false;
      formWidget.submit();
    };

    // Finish - save changes
    formWidget.on("submit", async (evt) => {
      const layer = formWidget.feature.layer;
      const response = await layer.applyEdits({ updateFeatures: [formWidget.feature] });
      // Show a different message depending on if the update was successful
      const updateDidSave = response.updateFeatureResults.length && !response.updateFeatureResults[0].error;

      document.getElementById("success-label").hidden = !updateDidSave;
      document.getElementById("error-label").hidden = updateDidSave;

      onRequestComplete();
    });

    // Used to identify the nearest feature based on the provided view event.
    // Nearest result is used when multiple hits are returned.
    async function getClosestFeature(evt) {
      const response = await view.hitTest(evt);

      if (response.results.length) {
        const result = response.results[0];

        if (result.graphic && result.graphic.geometry) {
          return result.graphic;
        }
      }

      return null;
    }

    // Returns full resolution feature from the layer
    async function getFullFeature(feature) {
      const layer = feature.layer;
      const query = layer.createQuery();
      query.outFields = ["*"];
      query.objectIds = [feature.attributes[layer.objectIdField]];

      const response = await layer.queryFeatures(query);

      return response.features.length ? response.features[0] : null;
    }

    function onRequestComplete() {
      document.getElementById("submit-loader").hidden = true;
      document.getElementById("feature-container").hidden = false;
      document.getElementById("cancel-button").disabled = true;
      document.getElementById("submit-button").disabled = true;
    }

    // Loop through updated attributes and assign
    // the updated values to feature attributes.
    function getUpdatedFeature(feature, attributes) {
      Object.keys(attributes).forEach((key) => {
        feature.attributes[key] = attributes[key];
      });

      return feature;
    }

    //////////////////////////////////////////////////////
    //  UI Visibility
    //////////////////////////////////////////////////////

    // Hide the loading indicator; show the app
    view.when(() => {
      document.querySelector("calcite-loader").hidden = true;
    });

    // Logic for displaying the 'Next' button after 
    // updating the form in the 'Details' step.
    formWidget.on("value-change", (evt) => {
      document.getElementById("go-to-review-button").disabled = false;
      document.getElementById("details-stepper--review").disabled = false;
    });

    // document.getElementById("go-to-review-button").onclick = () => goToStep("review");
    document.getElementById("cancel-button").onclick = () => goToStep("location");
    document.getElementById("restart-button").onclick = () => goToStep("location");

    // Logic for setting the current step based on interaction with
    // specific <calcite-stepper-item> components.
    document.querySelectorAll("calcite-stepper")
      .forEach((stepper) => stepper.addEventListener(
        "calciteStepperItemChange",
        () => goToStep(stepper.selectedItem.dataset.actionId)
      ));

    // Logic controlling the current app state, represented by different steps.
    // Different steps utilize different views or modals.
    function goToStep(id) {
      const locationModal = document.getElementById("location-modal");
      const detailsModal = document.getElementById("details-modal");
      const reviewModal = document.getElementById("review-modal");

      // Open the associated calcite-modal 
      locationModal.open = locationModal.id.includes(id);
      detailsModal.open = detailsModal.id.includes(id);
      reviewModal.open = reviewModal.id.includes(id);

      switch (id) {
        case "review":
          document.getElementById("review-content-wrapper").hidden = false;
          document.getElementById("review-stepper--review").selected = true;
          document.getElementById("success-label").hidden = true;
          document.getElementById("error-label").hidden = true;
          document.getElementById("cancel-button").disabled = false;
          document.getElementById("submit-button").disabled = false;
          break;
        case "details":
          document.getElementById("details-stepper--details").selected = true;
          document.getElementById("go-to-review-button").disabled = true;
          break;
        case "location":
        default:
          formWidget.feature = null;
          document.getElementById("location-stepper--location").selected = true;
      }
    }
  });