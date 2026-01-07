import React, { useEffect, useRef, useContext } from "react";

// Context
import { contentStateContext } from "../context/ContentState";

const ClickZoom = () => {
  const [contentState] = useContext(contentStateContext);
  const contentStateRef = useRef(contentState);
  const isZoomedRef = useRef(false);
  const zoomTimeoutRef = useRef(null);
  const cursorXRef = useRef(0);
  const cursorYRef = useRef(0);
  const zoomWrapperRef = useRef(null);
  const isSetupRef = useRef(false);

  // Zoom configuration
  const ZOOM_SCALE = 1.2; // Zoom level on click
  const ZOOM_IN_DURATION = 150; // ms for zoom in animation
  const ZOOM_OUT_DURATION = 300; // ms for zoom out animation
  const ZOOM_HOLD_DELAY = 50; // ms delay before zoom out starts after mouseup
  const WRAPPER_ID = "screenity-click-zoom-wrap";

  useEffect(() => {
    contentStateRef.current = contentState;
  }, [contentState]);

  // Create zoom wrapper for the page content
  const setupZoomWrapper = () => {
    // Check if ZoomContainer's wrapper exists (reuse it if available)
    let existingWrapper = document.querySelector("#screenity-zoom-wrap");
    if (existingWrapper) {
      zoomWrapperRef.current = existingWrapper;
      isSetupRef.current = true;
      return;
    }

    // Check if our own wrapper already exists
    existingWrapper = document.querySelector(`#${WRAPPER_ID}`);
    if (existingWrapper) {
      zoomWrapperRef.current = existingWrapper;
      isSetupRef.current = true;
      return;
    }

    // Create new wrapper
    const div = document.createElement("div");
    div.id = WRAPPER_ID;
    div.style.width = "100%";
    div.style.minHeight = "100vh";
    div.style.transformOrigin = "0 0";

    // Move body's children into this wrapper (except screenity UI)
    const children = Array.from(document.body.childNodes);
    children.forEach((child) => {
      if (
        child.nodeType === Node.ELEMENT_NODE &&
        (child.id === "screenity-ui" || child.id === "screenity-root-container")
      ) {
        return;
      }
      div.appendChild(child);
    });

    // Insert wrapper at the beginning of body
    document.body.prepend(div);

    // Make sure screenity UI is at the end
    const screenityUI = document.getElementById("screenity-ui");
    if (screenityUI) {
      document.body.appendChild(screenityUI);
    }

    zoomWrapperRef.current = div;
    isSetupRef.current = true;
  };

  // Cleanup zoom wrapper
  const cleanupZoomWrapper = () => {
    // Don't remove if it's ZoomContainer's wrapper
    if (zoomWrapperRef.current?.id === "screenity-zoom-wrap") {
      zoomWrapperRef.current = null;
      isSetupRef.current = false;
      return;
    }

    const wrapper = document.querySelector(`#${WRAPPER_ID}`);
    if (wrapper) {
      // Move children back to body
      while (wrapper.firstChild) {
        document.body.prepend(wrapper.firstChild);
      }
      wrapper.remove();
    }

    zoomWrapperRef.current = null;
    isSetupRef.current = false;
  };

  const applyZoom = (scale, originX, originY, duration) => {
    const wrapper = zoomWrapperRef.current;
    if (!wrapper) return;

    wrapper.style.transition = `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    wrapper.style.transformOrigin = `${originX}px ${originY}px`;
    wrapper.style.transform = scale === 1 ? "scale(1)" : `scale(${scale})`;

    // Also apply to canvas wrapper if it exists
    const canvasWrapper = document.querySelector("#canvas-wrapper-screenity");
    if (canvasWrapper) {
      const fixedOriginX = originX - window.scrollX;
      const fixedOriginY = originY - window.scrollY;
      canvasWrapper.style.transition = `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
      canvasWrapper.style.transformOrigin = `${fixedOriginX}px ${fixedOriginY}px`;
      canvasWrapper.style.transform = scale === 1 ? "scale(1)" : `scale(${scale})`;
    }
  };

  const handleMouseDown = (e) => {
    // Check if click zoom is enabled
    if (!contentStateRef.current.clickZoom) return;
    if (!contentStateRef.current.recording) return;

    // Ignore clicks on toolbar and UI elements
    if (
      e.target.closest(".ToolbarRoot") ||
      e.target.closest(".ToolbarRecordingControls") ||
      e.target.closest(".ToolbarToggleWrap") ||
      e.target.closest(".ToolbarPaused") ||
      e.target.closest(".Toast") ||
      e.target.closest("#screenity-root-container") ||
      e.target.closest("#screenity-ui") ||
      e.target.closest(`#${WRAPPER_ID}`) === null
    ) {
      // Only check wrapper containment if wrapper exists and click is not in UI
      if (
        e.target.closest(".ToolbarRoot") ||
        e.target.closest(".ToolbarRecordingControls") ||
        e.target.closest(".ToolbarToggleWrap") ||
        e.target.closest(".ToolbarPaused") ||
        e.target.closest(".Toast") ||
        e.target.closest("#screenity-root-container") ||
        e.target.closest("#screenity-ui")
      ) {
        return;
      }
    }

    // Ensure wrapper is set up
    if (!isSetupRef.current) {
      setupZoomWrapper();
    }

    // Clear any pending zoom out
    if (zoomTimeoutRef.current) {
      clearTimeout(zoomTimeoutRef.current);
      zoomTimeoutRef.current = null;
    }

    // Get cursor position relative to document
    const { top, left } = document.documentElement.getBoundingClientRect();
    cursorXRef.current = e.clientX - left;
    cursorYRef.current = e.clientY - top;

    // Apply zoom in
    isZoomedRef.current = true;
    applyZoom(ZOOM_SCALE, cursorXRef.current, cursorYRef.current, ZOOM_IN_DURATION);
  };

  const handleMouseUp = () => {
    if (!isZoomedRef.current) return;

    // Delay zoom out slightly for better visual effect
    zoomTimeoutRef.current = setTimeout(() => {
      isZoomedRef.current = false;
      applyZoom(1, cursorXRef.current, cursorYRef.current, ZOOM_OUT_DURATION);
    }, ZOOM_HOLD_DELAY);
  };

  // Set up wrapper when recording starts with click zoom enabled
  useEffect(() => {
    if (contentState.clickZoom && contentState.recording && contentState.showExtension) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        setupZoomWrapper();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [contentState.clickZoom, contentState.recording, contentState.showExtension]);

  useEffect(() => {
    window.addEventListener("mousedown", handleMouseDown, true);
    window.addEventListener("mouseup", handleMouseUp, true);

    return () => {
      window.removeEventListener("mousedown", handleMouseDown, true);
      window.removeEventListener("mouseup", handleMouseUp, true);

      // Clear any pending timeouts
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
      }

      // Reset zoom
      if (zoomWrapperRef.current) {
        zoomWrapperRef.current.style.transition = "";
        zoomWrapperRef.current.style.transform = "";
        zoomWrapperRef.current.style.transformOrigin = "";
      }
    };
  }, []);

  // Reset zoom when recording stops or click zoom is disabled
  useEffect(() => {
    if (!contentState.clickZoom || !contentState.recording) {
      if (isZoomedRef.current) {
        isZoomedRef.current = false;
        applyZoom(1, cursorXRef.current, cursorYRef.current, ZOOM_OUT_DURATION);
      }
    }
  }, [contentState.clickZoom, contentState.recording]);

  // Cleanup wrapper when component unmounts or feature is disabled
  useEffect(() => {
    return () => {
      cleanupZoomWrapper();
    };
  }, []);

  return null;
};

export default ClickZoom;
