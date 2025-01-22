import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import Editor from "@monaco-editor/react";
import SwaggerUI from "swagger-ui-react";
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Paper,
  Snackbar,
  Alert,
  Menu,
  MenuItem,
  Button,
  List,
  ListItem,
  ListItemText,
  Divider,
  Collapse,
  ListItemButton,
  Chip,
  IconButton,
  Switch,
  TextField,
  InputAdornment,
} from "@mui/material";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ErrorIcon from "@mui/icons-material/Error";
import WarningIcon from "@mui/icons-material/Warning";
import InfoIcon from "@mui/icons-material/Info";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import CodeIcon from "@mui/icons-material/Code";
import MagicIcon from "@mui/icons-material/AutoAwesome"; // Import the magic icon
import SearchIcon from "@mui/icons-material/Search";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import Brightness7Icon from "@mui/icons-material/Brightness7"; // Sun icon for light mode
import Brightness4Icon from "@mui/icons-material/Brightness4"; // Moon icon for dark mode
import yaml from "js-yaml";
import "swagger-ui-react/swagger-ui.css";
import logo from "./resources/logo.png"; // Import the logo
import "./App.css"; // Import the CSS file where the font is defined
import defaultContent from "./defaultContent"; // Import the default content
import DragDropContext from "react-beautiful-dnd"; // Import Drag and Drop context
import NoCodeMode from "./NoCodeMode"; // Ensure this is a default import

const methodColors = {
  GET: "#61affe",
  POST: "#49cc90",
  PUT: "#fca130",
  DELETE: "#f93e3e",
  PATCH: "#50e3c2",
  OPTIONS: "#0d5aa7",
  HEAD: "#9012fe",
};

const App = () => {
  const [editorContent, setEditorContent] = useState("");
  const [anchorEl, setAnchorEl] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info",
  });
  const [parsedSpec, setParsedSpec] = useState(null);
  const [endpoints, setEndpoints] = useState({});
  const [openPaths, setOpenPaths] = useState({});
  const [diagnostics, setDiagnostics] = useState([]);
  const [diagnosticViews, setDiagnosticViews] = useState({
    error: true,
    warning: true,
    info: true,
  });
  const [isDiagnosticsMinimized, setIsDiagnosticsMinimized] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isYaml, setIsYaml] = useState(true);
  const [schemas, setSchemas] = useState({});
  const [openSchemas, setOpenSchemas] = useState({});
  const [isNoCodeMode, setIsNoCodeMode] = useState(true); // New state for no-code mode
  const [isDarkMode, setIsDarkMode] = useState(true); // New state for dark mode
  const [isPreviewVisible, setIsPreviewVisible] = useState(true); // New state for preview visibility
  const [searchQuery, setSearchQuery] = useState(""); // New state for search query
  const editorRef = useRef(null);
  const swaggerUIRef = useRef(null);

  // Initialize with default OpenAPI template
  useEffect(() => {
    const savedContent = localStorage.getItem("openspec-content");
    if (savedContent) {
      setEditorContent(savedContent);
      validateAndUpdatePreview(savedContent);
    } else {
      setEditorContent(defaultContent);
      validateAndUpdatePreview(defaultContent);
    }
  }, []);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.layout();
    }
  }, [isPreviewVisible]);

  const extractEndpoints = (spec) => {
    if (!spec || !spec.paths) return {};
    const groupedEndpoints = {};

    Object.entries(spec.paths).forEach(([path, methods]) => {
      groupedEndpoints[path] = Object.entries(methods).map(
        ([method, details]) => ({
          method: method.toUpperCase(),
          summary: details.summary || "No summary",
          operationId: details.operationId,
        })
      );
    });

    return groupedEndpoints;
  };

  const extractSchemas = (spec) => {
    if (!spec || !spec.components || !spec.components.schemas) return {};
    return spec.components.schemas;
  };

  const validateAndUpdatePreview = (content) => {
    try {
      const parsed = yaml.load(content);
      console.log("Parsed YAML:", parsed); // Debugging log
      setParsedSpec(parsed);
      setEndpoints(extractEndpoints(parsed));
      setSchemas(extractSchemas(parsed));
      setValidationErrors([]);
      // Add success diagnostic
      setDiagnostics([
        {
          type: "info",
          message: "YAML parsed successfully",
          line: null,
          timestamp: Date.now(),
        },
      ]);
    } catch (error) {
      console.error("YAML Parsing Error:", error.message); // Debugging log
      const lineMatch = error.message.match(/line (\d+)/);
      const line = lineMatch ? parseInt(lineMatch[1]) : null;

      setValidationErrors([{ message: error.message }]);
      setParsedSpec(null);
      setEndpoints({});
      setSchemas({});

      // Add error diagnostic
      setDiagnostics((prev) => [
        {
          type: "error",
          message: error.message,
          line,
          timestamp: Date.now(),
        },
        ...prev.slice(0, 49),
      ]); // Keep last 50 messages
    }
  };

  const handleEditorChange = (value) => {
    setEditorContent(value);
    validateAndUpdatePreview(value);
  };

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
  };

  const findLineNumber = (content, path, method) => {
    const lines = content.split("\n");
    const pathLine = lines.findIndex((line) => line.includes(path));
    if (pathLine === -1) return 0;

    for (let i = pathLine; i < lines.length; i++) {
      if (lines[i].trim().startsWith(method.toLowerCase() + ":")) {
        return i + 1;
      }
    }
    return pathLine + 1;
  };

  const handlePathClick = (path) => {
    setOpenPaths((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  const handleEndpointClick = (path, method) => {
    // Navigate editor to the line
    if (editorRef.current) {
      const lineNumber = findLineNumber(editorContent, path, method);
      editorRef.current.revealLineInCenter(lineNumber);
      editorRef.current.setPosition({ lineNumber, column: 1 });
    }

    // Find and click the operation in SwaggerUI
    const opId = endpoints[path]?.find(
      (ep) => ep.method === method
    )?.operationId;
    const selector = opId
      ? `#operations-tag-${opId}`
      : `[data-path="${path}"][data-method="${method.toLowerCase()}"]`;

    const element = document.querySelector(selector);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.click(); // This will expand the operation in SwaggerUI
    }
  };

  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNewFile = () => {
    setEditorContent(defaultContent);
    validateAndUpdatePreview(defaultContent);
    handleMenuClose();
  };

  const handleImportFile = (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      setEditorContent(content);
      validateAndUpdatePreview(content);
    };
    reader.readAsText(file);
    handleMenuClose();
  };

  const handleExportFile = () => {
    const blob = new Blob([editorContent], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "openapi.yaml";
    a.click();
    URL.revokeObjectURL(url);
    handleMenuClose();
  };

  const handleDiagnosticClick = (line) => {
    if (line && editorRef.current) {
      editorRef.current.revealLineInCenter(line);
      editorRef.current.setPosition({ lineNumber: line, column: 1 });
    }
  };

  const groupDiagnostics = (diagnostics) => {
    return diagnostics.reduce(
      (acc, diagnostic) => {
        if (!acc[diagnostic.type]) {
          acc[diagnostic.type] = [];
        }
        acc[diagnostic.type].push(diagnostic);
        return acc;
      },
      { error: [], warning: [], info: [] }
    );
  };

  const handleDiagnosticViewToggle = (type) => {
    setDiagnosticViews((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  const handleFullScreenToggle = () => {
    const editorContainer = document.getElementById("editor-container");
    if (!isFullScreen) {
      if (editorContainer.requestFullscreen) {
        editorContainer.requestFullscreen();
      } else if (editorContainer.mozRequestFullScreen) {
        /* Firefox */
        editorContainer.mozRequestFullScreen();
      } else if (editorContainer.webkitRequestFullscreen) {
        /* Chrome, Safari and Opera */
        editorContainer.webkitRequestFullscreen();
      } else if (editorContainer.msRequestFullscreen) {
        /* IE/Edge */
        editorContainer.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.mozCancelFullScreen) {
        /* Firefox */
        document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        /* Chrome, Safari and Opera */
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        /* IE/Edge */
        document.msExitFullscreen();
      }
    }
    setIsFullScreen(!isFullScreen);
  };

  const handleFormatToggle = () => {
    setIsYaml(!isYaml);
    const content = isYaml
      ? JSON.stringify(yaml.load(editorContent), null, 2)
      : yaml.dump(JSON.parse(editorContent));
    setEditorContent(content);
  };

  const handleSchemaClick = (name) => {
    setOpenSchemas((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const handleNoCodeModeToggle = () => {
    setIsNoCodeMode(!isNoCodeMode);
  };

  const handleDarkModeToggle = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handlePreviewToggle = () => {
    setIsPreviewVisible(!isPreviewVisible);
  };

  const handleSpecificationChange = useCallback((spec) => {
    // Prevent unnecessary updates
    if (JSON.stringify(spec) === JSON.stringify(parsedSpec)) {
      return;
    }

    const content = yaml.dump(spec);
    setEditorContent(content);
    setParsedSpec(spec);
  }, [parsedSpec]);

  const filteredEndpoints = Object.entries(endpoints).filter(([path]) =>
    path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSchemas = Object.entries(schemas).filter(([name]) =>
    name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <AppBar
        position="static"
        style={{ backgroundColor: "#008d1f", height: "48px" }}
      >
        <Toolbar
          style={{
            minHeight: "48px",
            paddingLeft: "8px",
            paddingRight: "8px",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <img
              src={logo}
              alt="Logo"
              style={{ marginRight: "1rem", height: "30px" }}
            />
            <Typography
              variant="h6"
              style={{ fontWeight: 400, fontSize: "1rem" }}
            >
              OpenSpec Studio
            </Typography>
            <Button
              color="inherit"
              onClick={handleMenuClick}
              style={{
                marginLeft: "16px",
                fontSize: "0.875rem",
                fontWeight: 100,
              }}
            >
              File
            </Button>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
            >
              <MenuItem
                onClick={handleNewFile}
                style={{ fontSize: "0.875rem" }}
              >
                New
              </MenuItem>
              <MenuItem>
                <label
                  htmlFor="import-file"
                  style={{ cursor: "pointer", fontSize: "0.875rem" }}
                >
                  Import
                </label>
                <input
                  id="import-file"
                  type="file"
                  accept=".yaml,.yml,.json"
                  style={{ display: "none" }}
                  onChange={handleImportFile}
                />
              </MenuItem>
              <MenuItem
                onClick={handleExportFile}
                style={{ fontSize: "0.875rem" }}
              >
                Export
              </MenuItem>
            </Menu>
          </div>
          <Button
            color="inherit"
            onClick={handleNoCodeModeToggle}
            style={{
              fontSize: "0.875rem",
              display: "flex",
              alignItems: "center",
            }}
          >
            {isNoCodeMode ? (
              <>
                <CodeIcon style={{ marginRight: "4px" }} />
                Code Mode
              </>
            ) : (
              <>
                <MagicIcon style={{ marginRight: "4px" }} />
                No-Code Mode
              </>
            )}
          </Button>
        </Toolbar>
      </AppBar>

      {isNoCodeMode ? (
        <NoCodeMode
          key="nocode-editor"
          initialSpec={parsedSpec}
          onSpecificationChange={handleSpecificationChange}
        />
      ) : (
        <>
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            <Paper
              elevation={3}
              style={{
                width: "250px",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                borderRadius: 0,
              }}
            >
              <TextField
                placeholder="Search..."
                variant="filled"
                size="small"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  style: { fontSize: '12px', padding: '2px 8px' }, // Adjust padding to reduce height
                }}
                style={{ margin: "2px" }}
              />
              <Typography
                variant="h6"
                style={{
                  padding: "0.5rem",
                  paddingBottom: "0.5rem",
                  fontSize: "0.9rem",
                  color: "#ffffff",
                  backgroundColor: "#444",
                }}
              >
                Paths
              </Typography>
              <List style={{ overflow: "auto", flex: 1, padding: "0.25rem" }}>
                {filteredEndpoints.map(([path, methods]) => (
                  <React.Fragment key={path}>
                    <ListItem style={{ padding: "4px 4px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          fontSize: "0.55rem", // Smaller font size
                        }}
                      >
                        <ListItemText
                          primary={path}
                          style={{ fontSize: "0.55rem" }} // Smaller font size
                        />
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            marginLeft: "8px",
                          }}
                        >
                          {methods.map((endpoint) => (
                            <div
                              key={`${endpoint.method}-${path}`}
                              style={{
                                backgroundColor:
                                  methodColors[endpoint.method] || "#ccc",
                                color: "white",
                                width: "16px",
                                height: "16px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: "2px",
                                margin: "2px",
                                cursor: "pointer",
                                fontSize: "0.65rem",
                                fontWeight: "bold",
                              }}
                              onClick={() =>
                                handleEndpointClick(path, endpoint.method)
                              }
                            >
                              {endpoint.method[0]}
                            </div>
                          ))}
                        </div>
                      </div>
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>

              <Typography
                variant="h6"
                style={{
                  padding: "0.5rem",
                  paddingBottom: "0.5rem",
                  fontSize: "0.9rem",
                  color: "#ffffff",
                  backgroundColor: "#444",
                }}
              >
                Schemas
              </Typography>
              <List style={{ overflow: "auto", flex: 1, padding: "0.25rem" }}>
                {filteredSchemas.map(([name, schema]) => (
                  <React.Fragment key={name}>
                    <ListItemButton
                      onClick={() => handleSchemaClick(name)}
                      style={{ padding: "4px 8px" }}
                    >
                      <ListItemText
                        primary={name}
                        style={{ fontSize: "0.55rem" }} // Smaller font size
                      />
                      {openSchemas[name] ? <ExpandLess /> : <ExpandMore />}
                    </ListItemButton>
                    <Collapse
                      in={openSchemas[name]}
                      timeout="auto"
                      unmountOnExit
                    >
                      <List component="div" disablePadding>
                        <ListItem style={{ padding: "4px 8px" }}>
                          <pre style={{ fontSize: "0.55rem", margin: 0 }}>
                            {JSON.stringify(schema, null, 2)}
                          </pre>
                        </ListItem>
                      </List>
                    </Collapse>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            </Paper>

            <Container
              maxWidth="xl"
              style={{
                flex: 1,
                padding: "1rem",
                display: "flex",
                overflow: "hidden",
              }}
            >
              <Paper
                elevation={3}
                id="editor-container"
                style={{
                  padding: "0.5rem",
                  flex: 1,
                  marginRight: "0.5rem",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Typography
                    variant="h6"
                    gutterBottom
                    style={{ fontSize: "1rem" }}
                  >
                    Code
                  </Typography>
                  <div>
                    <IconButton
                      size="small"
                      onClick={handlePreviewToggle}
                      title="Toggle Preview"
                    >
                      {isPreviewVisible ? (
                        <VisibilityOffIcon />
                      ) : (
                        <VisibilityIcon />
                      )}
                    </IconButton>
                    <Button
                      size="small"
                      onClick={handleFormatToggle}
                      title={`Switch to ${isYaml ? "JSON" : "YAML"}`}
                      style={{
                        fontSize: "0.75rem",
                        marginRight: "8px",
                        color: "gray",
                        fontWeight: "bold",
                      }}
                    >
                      {isYaml ? "<YAML>" : "{JSON}"}
                    </Button>
                    <IconButton
                      size="small"
                      onClick={handleFullScreenToggle}
                      title="Toggle Full Screen"
                    >
                      {isFullScreen ? (
                        <FullscreenExitIcon />
                      ) : (
                        <FullscreenIcon />
                      )}
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={handleDarkModeToggle}
                      title="Toggle Dark Mode"
                    >
                      {isDarkMode ? <Brightness7Icon /> : <Brightness4Icon />}
                    </IconButton>
                  </div>
                </div>
                <Editor
                  key={isPreviewVisible} // Add this line
                  height="100%"
                  defaultLanguage={isYaml ? "yaml" : "json"}
                  value={editorContent}
                  onChange={handleEditorChange}
                  theme={isDarkMode ? "vs-dark" : "light"}
                  onMount={handleEditorDidMount}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 12,
                  }}
                />
              </Paper>

              {isPreviewVisible && (
                <Paper
                  elevation={3}
                  style={{
                    padding: "0.5rem",
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                  }}
                >
                  <Typography
                    variant="h6"
                    gutterBottom
                    style={{ fontSize: "1rem" }}
                  >
                    Preview
                  </Typography>
                  <div
                    style={{
                      flex: 1,
                      overflow: "auto",
                      fontSize: "0.75rem",
                      minWidth: 0,
                    }}
                  >
                    {parsedSpec ? (
                      <SwaggerUI spec={parsedSpec} />
                    ) : (
                      <Typography>No preview available</Typography>
                    )}
                  </div>
                </Paper>
              )}
            </Container>
          </div>
          <Paper
            elevation={3}
            style={{
              height: isDiagnosticsMinimized ? "30px" : "150px",
              overflow: "hidden",
              backgroundColor: "#f5f5f5",
              borderTop: "1px solid #ddd",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "4px",
                borderBottom: "1px solid #ddd",
                display: "flex",
                gap: "8px",
                alignItems: "center",
              }}
            >
              <Typography variant="subtitle2" style={{ fontSize: "0.875rem" }}>
                Diagnostics
              </Typography>
              <IconButton
                size="small"
                onClick={() =>
                  setIsDiagnosticsMinimized(!isDiagnosticsMinimized)
                }
              >
                {isDiagnosticsMinimized ? <ExpandMore /> : <ExpandLess />}
              </IconButton>
              {!isDiagnosticsMinimized &&
                ["error", "warning", "info"].map((type) => {
                  const items = groupDiagnostics(diagnostics)[type] || [];
                  return (
                    <Button
                      key={type}
                      size="small"
                      variant={diagnosticViews[type] ? "contained" : "outlined"}
                      color={
                        type === "error"
                          ? "error"
                          : type === "warning"
                          ? "warning"
                          : "info"
                      }
                      onClick={() => handleDiagnosticViewToggle(type)}
                      startIcon={
                        type === "error" ? (
                          <ErrorIcon />
                        ) : type === "warning" ? (
                          <WarningIcon />
                        ) : (
                          <InfoIcon />
                        )
                      }
                      style={{
                        minWidth: "80px",
                        fontSize: "0.75rem",
                        opacity: items.length > 0 ? 1 : 0.7,
                      }}
                    >
                      {type} ({items.length})
                    </Button>
                  );
                })}
            </div>

            {!isDiagnosticsMinimized && (
              <div style={{ flex: 1, overflow: "auto", padding: "4px" }}>
                {Object.entries(groupDiagnostics(diagnostics)).map(
                  ([type, items]) =>
                    diagnosticViews[type] &&
                    items.length > 0 && (
                      <div key={type} style={{ marginBottom: "8px" }}>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                          }}
                        >
                          {items.map((diagnostic) => (
                            <div
                              key={diagnostic.timestamp}
                              className="diagnostic-item"
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "2px 4px",
                                borderRadius: "4px",
                                cursor: diagnostic.line ? "pointer" : "default",
                                backgroundColor: "white",
                              }}
                              onClick={() =>
                                handleDiagnosticClick(diagnostic.line)
                              }
                              data-has-line={!!diagnostic.line}
                            >
                              {type === "error" && (
                                <ErrorIcon
                                  color="error"
                                  style={{ fontSize: "1rem" }}
                                />
                              )}
                              {type === "warning" && (
                                <WarningIcon
                                  color="warning"
                                  style={{ fontSize: "1rem" }}
                                />
                              )}
                              {type === "info" && (
                                <InfoIcon
                                  color="info"
                                  style={{ fontSize: "1rem" }}
                                />
                              )}
                              <Typography
                                variant="body2"
                                style={{ flex: 1, fontSize: "0.75rem" }}
                              >
                                {diagnostic.message}
                              </Typography>
                              {diagnostic.line && (
                                <Chip
                                  label={`Line ${diagnostic.line}`}
                                  size="small"
                                  variant="outlined"
                                  style={{ fontSize: "0.75rem" }}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                )}
              </div>
            )}
          </Paper>
        </>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} style={{ fontSize: "0.875rem" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default memo(App);
