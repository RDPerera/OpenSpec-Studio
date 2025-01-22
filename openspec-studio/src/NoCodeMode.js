import React, { useState, useCallback, useRef } from 'react';
import {
  Paper,
  Typography,
  IconButton,
  Box,
  Button,
  TextField,
  MenuItem,
} from '@mui/material';
import TagIcon from '@mui/icons-material/Tag';
import RouteIcon from '@mui/icons-material/Route';
import DnsIcon from '@mui/icons-material/Dns';
import HttpIcon from '@mui/icons-material/Http';
import SecurityIcon from '@mui/icons-material/Security';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SettingsIcon from '@mui/icons-material/Settings';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
} from 'reactflow';
import 'reactflow/dist/style.css';

const nodeTemplates = [
  { 
    type: "Tag",
    icon: TagIcon,
    color: "#61affe",
    properties: ['name', 'description']
  },
  { 
    type: "Path",
    icon: RouteIcon,
    color: "#49cc90",
    properties: ['path', 'summary', 'description', 'operationId']
  },
  { 
    type: "Server",
    icon: DnsIcon,
    color: "#fca130",
    properties: ['url', 'description', 'variables']
  },
  { 
    type: "Method",
    icon: HttpIcon,
    color: "#f93e3e",
    properties: ['method', 'tags', 'summary', 'description', 'parameters', 'requestBody', 'responses']
  },
  { 
    type: "Security",
    icon: SecurityIcon,
    color: "#50e3c2",
    properties: ['type', 'name', 'scheme', 'bearerFormat', 'flows']
  },
];

const getPropertiesForType = (nodeType) => {
  const template = nodeTemplates.find(t => t.type === nodeType);
  return template ? template.properties : [];
};

const generateId = () => `node_${Date.now()}`;

const getNodeLabel = (nodeType, properties) => {
  if (!properties) return nodeType;
  
  switch (nodeType) {
    case 'Tag':
      return `${nodeType}\n${properties.name || 'Unnamed'}`;
    case 'Path':
      return `${nodeType}\n${properties.path || '/'}`;
    case 'Server':
      return `${nodeType}\n${properties.url || 'http://'}`;
    case 'Method':
      return `${(properties.method || 'GET').toUpperCase()}\n${properties.summary || ''}`;
    case 'Security':
      return `${nodeType}\n${properties.type || 'apiKey'}: ${properties.name || ''}`;
    default:
      return nodeType;
  }
};

const customNodeStyle = (nodeType, properties) => {
  const template = nodeTemplates.find(t => t.type === nodeType);
  return {
    background: '#ffffff',
    color: template?.color || '#666',
    border: `2px solid ${template?.color || '#ccc'}`,
    borderRadius: '4px',
    padding: '15px',
    width: '180px',
    fontSize: '12px',
    whiteSpace: 'pre-wrap',
    textAlign: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
    }
  };
};

const NoCodeOpenAPI = () => {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([
    { id: 'central', type: 'default', position: { x: 300, y: 200 }, data: { label: 'Main API' } },
  ]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodeProperties, setNodeProperties] = useState({});

  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeType));
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = (event) => {
    event.preventDefault();

    const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
    const nodeTypeData = JSON.parse(event.dataTransfer.getData('application/reactflow'));

    if (!nodeTypeData) return;

    const position = {
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    };

    const newNode = {
      id: generateId(),
      type: 'default',
      position,
      data: { 
        label: nodeTypeData.type,
        color: nodeTypeData.color,
        icon: nodeTypeData.type
      },
      style: customNodeStyle(nodeTypeData.type)
    };

    setNodes((nds) => [...nds, newNode]);

    // Automatically connect to central or selected node
    const targetNodeId = selectedNode?.id || 'central';
    setEdges((eds) => addEdge({ id: generateId(), source: targetNodeId, target: newNode.id }, eds));
  };

  const onNodeClick = (event, node) => {
    event.preventDefault();
    setSelectedNode(node);
    // Initialize properties based on node type
    const properties = {};
    const nodeProperties = node.data.properties || {};
    getPropertiesForType(node.data.label).forEach(prop => {
      properties[prop] = nodeProperties[prop] || '';
    });
    setNodeProperties(properties);
  };

  const onPaneClick = () => {
    setSelectedNode(null);
    setNodeProperties({});
  };

  const handlePropertyChange = (key, value) => {
    setNodeProperties((props) => ({ ...props, [key]: value }));
  };

  const saveProperties = () => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === selectedNode.id
          ? {
              ...node,
              data: {
                ...node.data,
                properties: nodeProperties,
                label: getNodeLabel(node.data.label, nodeProperties)
              },
              style: customNodeStyle(node.data.label, nodeProperties)
            }
          : node
      )
    );
    // Update selected node to reflect changes
    setSelectedNode((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        properties: nodeProperties,
        label: getNodeLabel(prev.data.label, nodeProperties)
      },
      style: customNodeStyle(prev.data.label, nodeProperties)
    }));
  };

  const deleteNode = () => {
    setNodes((nds) => nds.filter((node) => node.id !== selectedNode.id));
    setEdges((eds) => eds.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id));
    setSelectedNode(null);
  };

  const renderPropertyField = (property) => {
    switch (property) {
      case 'method':
        return (
          <TextField
            key={property}
            select
            label={property}
            fullWidth
            size="small"
            value={nodeProperties[property] || 'get'}
            onChange={(event) => handlePropertyChange(property, event.target.value)}
            style={{ marginBottom: '10px' }}
          >
            {['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].map((method) => (
              <MenuItem key={method} value={method}>{method.toUpperCase()}</MenuItem>
            ))}
          </TextField>
        );
      case 'type':
        return (
          <TextField
            key={property}
            select
            label={property}
            fullWidth
            size="small"
            value={nodeProperties[property] || 'apiKey'}
            onChange={(event) => handlePropertyChange(property, event.target.value)}
            style={{ marginBottom: '10px' }}
          >
            {['apiKey', 'http', 'oauth2', 'openIdConnect'].map((type) => (
              <MenuItem key={type} value={type}>{type}</MenuItem>
            ))}
          </TextField>
        );
      case 'parameters':
      case 'variables':
      case 'flows':
      case 'responses':
        return (
          <TextField
            key={property}
            label={property}
            fullWidth
            size="small"
            multiline
            rows={3}
            value={nodeProperties[property] || ''}
            onChange={(event) => handlePropertyChange(property, event.target.value)}
            style={{ marginBottom: '10px' }}
          />
        );
      default:
        return (
          <TextField
            key={property}
            label={property}
            fullWidth
            size="small"
            value={nodeProperties[property] || ''}
            onChange={(event) => handlePropertyChange(property, event.target.value)}
            style={{ marginBottom: '10px' }}
          />
        );
    }
  };

  const renderProperties = () => (
    <Box p={2}>
      {selectedNode ? (
        <>
          {getPropertiesForType(selectedNode.data.label).map((property) => 
            renderPropertyField(property)
          )}
          <Box display="flex" justifyContent="space-between" mt={2}>
            <Button
              variant="contained"
              size="small"
              startIcon={<SaveIcon />}
              onClick={saveProperties}
              style={{ backgroundColor: '#008d1f' }}
            >
              Save
            </Button>
            <Button
              variant="contained"
              color="error"
              size="small"
              startIcon={<DeleteIcon />}
              onClick={deleteNode}
            >
              Delete
            </Button>
          </Box>
        </>
      ) : (
        <Typography variant="body2">Select a node to view properties</Typography>
      )}
      <Button
        variant="contained"
        fullWidth
        size="small"
        style={{ 
          marginTop: '20px',
          backgroundColor: '#008d1f'
        }}
        startIcon={<FileDownloadIcon />}
        onClick={exportOpenAPISchema}
      >
        Export OpenAPI Schema
      </Button>
    </Box>
  );

  const exportOpenAPISchema = () => {
    const schema = {
      openapi: '3.0.0',
      info: { title: 'Generated API', version: '1.0.0' },
      paths: {},
      components: { 
        securitySchemes: {},
        schemas: {},
      },
      servers: [],
    };

    nodes.forEach((node) => {
      const props = node.data.properties || {};
      
      switch (node.data.label) {
        case 'Server':
          schema.servers.push({
            url: props.url || 'http://example.com',
            description: props.description,
            variables: props.variables ? JSON.parse(props.variables) : {}
          });
          break;
        case 'Tag':
          schema.tags = schema.tags || [];
          schema.tags.push({
            name: props.name || 'Unnamed Tag',
            description: props.description
          });
          break;
        case 'Path':
          if (props.path) {
            schema.paths[props.path] = {
              summary: props.summary,
              description: props.description,
            };
          }
          break;
        case 'Method':
          // Find connected path node
          const pathEdge = edges.find(edge => edge.target === node.id);
          if (pathEdge) {
            const pathNode = nodes.find(n => n.id === pathEdge.source);
            if (pathNode && pathNode.data.properties?.path) {
              schema.paths[pathNode.data.properties.path] = {
                [props.method || 'get']: {
                  tags: props.tags ? props.tags.split(',').map(t => t.trim()) : [],
                  summary: props.summary,
                  description: props.description,
                  parameters: props.parameters ? JSON.parse(props.parameters) : [],
                  responses: props.responses ? JSON.parse(props.responses) : {}
                }
              };
            }
          }
          break;
        case 'Security':
          if (props.name) {
            schema.components.securitySchemes[props.name] = {
              type: props.type || 'apiKey',
              scheme: props.scheme,
              bearerFormat: props.bearerFormat,
              flows: props.flows ? JSON.parse(props.flows) : {}
            };
          }
          break;
      }
    });

    console.log('Generated OpenAPI Schema:', schema);
    return schema;
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 48px)' }}>
      {/* Left Sidebar - Node Templates */}
      <Paper 
        elevation={3} 
        style={{ 
          width: '250px',
          borderRadius: 0,
          background: '#f5f5f5',
          borderRight: '1px solid #ddd'
        }}
      >
        <Typography
          variant="h6"
          style={{
            padding: '0.5rem',
            fontSize: '0.9rem',
            color: '#ffffff',
            backgroundColor: '#444',
          }}
        >
          Components
        </Typography>
        <div style={{ padding: '8px' }}>
          {nodeTemplates.map((template) => {
            const Icon = template.icon;
            return (
              <div
                key={template.type}
                draggable
                onDragStart={(event) => onDragStart(event, template)}
                style={{
                  padding: '8px 12px',
                  margin: '4px 0',
                  background: template.color,
                  color: '#fff',
                  borderRadius: '4px',
                  cursor: 'grab',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '0.875rem',
                }}
              >
                <Icon style={{ marginRight: '8px', fontSize: '1.2rem' }} />
                {template.type}
              </div>
            )
          })}
        </div>
      </Paper>

      {/* Main Canvas */}
      <ReactFlowProvider>
        <div
          ref={reactFlowWrapper}
          style={{ 
            flex: 1,
            background: '#f8f8f8',
            overflow: 'hidden'
          }}
          onDrop={onDrop}
          onDragOver={(event) => event.preventDefault()}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
            style={{ background: '#f8f8f8' }}
          >
            <Controls />
            <Background color="#aaa" gap={16} />
          </ReactFlow>
        </div>
      </ReactFlowProvider>

      {/* Right Sidebar - Node Properties */}
      <Paper 
        elevation={3} 
        style={{ 
          width: '300px',
          borderRadius: 0,
          background: '#f5f5f5',
          borderLeft: '1px solid #ddd',
          padding: '0'
        }}
      >
        <Typography
          variant="h6"
          style={{
            padding: '0.5rem',
            fontSize: '0.9rem',
            color: '#ffffff',
            backgroundColor: '#444',
          }}
        >
          Properties
        </Typography>
        {renderProperties()}
      </Paper>
    </div>
  );
};

export default NoCodeOpenAPI;
