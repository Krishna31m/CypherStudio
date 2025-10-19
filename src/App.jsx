import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getAuth, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc, query, where } from 'firebase/firestore';

// --- Environment Variable Setup ---
const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};
const initialAuthToken = process.env.REACT_APP_INITIAL_AUTH_TOKEN || null;

// --- Firebase Initialization ---
let firebaseApp, db, auth;

// Validate Firebase config
const isValidConfig = firebaseConfig && 
  firebaseConfig.apiKey && 
  firebaseConfig.authDomain && 
  firebaseConfig.projectId;

if (isValidConfig) {
  try {
    firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp);
    auth = getAuth(firebaseApp);
    console.log("Firebase initialized successfully");
  } catch (error) {
    console.warn("Firebase initialization failed, falling back to local mode:", error);
    // Clear Firebase instances to ensure we don't partially use them
    firebaseApp = null;
    db = null;
    auth = null;
  }
} else {
  console.warn("Invalid Firebase config, running in local-only mode");
}

// --- Multi-Language Support Configuration ---
const LANGUAGE_CONFIGS = {
    'React.js': {
        icon: '⚛️',
        label: 'React.js',
        editable: true,
        files: {
            // Note: index.js imports App and handles React rendering logic
            '/src/index.js': { code: `import React from 'react';\nimport App from './App';\n\n// React entry point (Simulated).`, hidden: false, entry: true },
            '/src/App.js': {
                code: `import React, { useState } from 'react';\n\n// Main App Component\nconst App = () => {\n  const [count, setCount] = useState(0);\n\n  const increment = () => {\n      setCount(c => c + 1);\n  };\n\n  return (\n    <div className="flex flex-col items-center p-4 min-h-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white">\n      <h1 className="text-3xl font-bold mb-4 text-green-500">CipherStudio Live React App</h1>\n      <p className="text-xl mb-6">Count: {count}</p>\n      <button onClick={increment} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 shadow-md">\n        Increment\n      </button>\n      <p className="mt-8 text-sm text-gray-500">Edit code in /src/App.js to see changes here!</p>\n    </div>\n  );\n};\n\nexport default App;`,
                hidden: false,
            },
            '/src/styles.css': { code: `/* Global styles for React app */\nbody { font-family: sans-serif; }`, hidden: false },
            '/public/index.html': { code: '<!DOCTYPE html>...', hidden: true },
            '/package.json': { code: '{"dependencies": {"react": "18.2.0"}}', hidden: true }
        },
        description: 'React environment. **Live rendering is now a static output simulation.**',
    },
    'JavaScript': { 
        icon: 'JS', 
        label: 'JavaScript', 
        editable: true,
        files: { '/index.js': { code: 'console.log("Hello pure JavaScript");', hidden: false, entry: true } }, 
        description: 'Pure JS environment. **Execution is simulated.**' 
    },
    'HTML': { 
        icon: 'HTML', 
        label: 'HTML', 
        editable: true,
        files: { '/index.html': { code: '<!DOCTYPE html>\n<html>\n<body>\n  <h1 class="text-2xl text-blue-500">Pure HTML Project</h1>\n  <p>This is editable.</p>\n</body>\n</html>', hidden: false, entry: true } }, 
        description: 'HTML environment. **Live HTML rendering enabled.**' 
    },
    'Python': {
        icon: '🐍',
        label: 'Python',
        editable: true,
        files: {
            '/main.py': { code: `def greet(name):\n    return f"Hello, {name}!"\n\n# Code is editable, but **execution is simulated**.\nprint(greet("Python Dev"))`, hidden: false, entry: true },
        },
        description: '**Editable Code/Files.** Execution is simulated.',
    },
    'Java': {
        icon: '☕',
        label: 'Java',
        editable: true,
        files: {
            '/Main.java': { code: `class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello Java World!");\n  }\n}`, hidden: false, entry: true },
        },
        description: '**Editable Code/Files.** Execution is simulated.',
    },
    'C++': { 
        icon: 'C++', 
        label: 'C++', 
        editable: true,
        files: { '/main.cpp': { code: '#include <iostream>\n\nint main() {\n  std::cout << "Hello C++" << std::endl;\n  return 0;\n}', hidden: false, entry: true } }, 
        description: '**Editable Code/Files.** Execution is simulated.',
    },
    'C#': { 
        icon: 'C#', 
        label: 'C#', 
        editable: true,
        files: { '/Program.cs': { code: 'using System;\n\nConsole.WriteLine("Hello C#");', hidden: false, entry: true } }, 
        description: '**Editable Code/Files.** Execution is simulated.' 
    },
    'Go': { 
        icon: 'Go', 
        label: 'Go', 
        editable: true,
        files: { '/main.go': { code: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello Go")\n}', hidden: false, entry: true } }, 
        description: '**Editable Code/Files.** Execution is simulated.' 
    },
    'Rust': { 
        icon: 'Rs', 
        label: 'Rust', 
        editable: true,
        files: { '/main.rs': { code: 'fn main() {\n    println!("Hello Rust!");\n}', hidden: false, entry: true } }, 
        description: '**Editable Code/Files.** Execution is simulated.' 
    },
};

// --- Helper Functions ---
const getLangInitialFiles = (language) => LANGUAGE_CONFIGS[language]?.files || LANGUAGE_CONFIGS['React.js'].files;
const getLanguageKeys = () => Object.keys(LANGUAGE_CONFIGS).sort();
const supportedConversionLangs = getLanguageKeys().filter(lang => lang !== 'React.js');


/**
 * Hook to manage project files, persistence, and state.
 */
const useProjectManager = (dbInstance, authInstance) => { 
  const [selectedLanguage, setSelectedLanguage] = useState('React.js');
  const [currentFiles, setCurrentFiles] = useState(getLangInitialFiles('React.js'));
  const [selectedPath, setSelectedPath] = useState('/src/App.js');
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isAutosaveEnabled, setIsAutosaveEnabled] = useState(true);

  // 1. Authentication and User ID setup
  useEffect(() => {
    const authenticate = async () => {
      if (!authInstance) {
        // If no auth instance, use local-only mode with a generated ID
        setUserId(crypto.randomUUID());
        setIsAuthReady(true);
        return;
      }

      try {
        if (initialAuthToken) {
          await signInWithCustomToken(authInstance, initialAuthToken);
        } else {
          // Try anonymous auth, fallback to local mode if it fails
          try {
            await signInAnonymously(authInstance);
          } catch (anonError) {
            console.warn("Anonymous auth disabled, using local mode:", anonError);
            setUserId(crypto.randomUUID());
            setIsAuthReady(true);
            return;
          }
        }
        setUserId(authInstance.currentUser?.uid || crypto.randomUUID());
        setIsAuthReady(true);
      } catch (error) {
        console.warn("Authentication failed, using local mode:", error);
        setUserId(crypto.randomUUID());
        setIsAuthReady(true);
      }
    };
    authenticate();
  }, [authInstance]);

  // Firestore path helper
  const getProjectPath = (id) => doc(dbInstance, 'artifacts', appId, 'users', userId, 'projects', id);

  // 2. File content update logic
  const updateFileContent = useCallback((path, newCode) => {
    setCurrentFiles(prevFiles => ({
      ...prevFiles,
      [path]: { ...prevFiles[path], code: newCode },
    }));
  }, []);

  // 3. Language Switch Logic
  const switchLanguage = useCallback((lang) => {
    setSelectedLanguage(lang);
    setCurrentFiles(getLangInitialFiles(lang));
    const newFiles = getLangInitialFiles(lang);
    const newPath = Object.keys(newFiles).find(p => newFiles[p].entry) || Object.keys(newFiles).sort()[0];
    setSelectedPath(newPath);
    setCurrentProjectId(crypto.randomUUID());
    setMessage(`Switched to ${lang}. Start a new project or save your work.`);
  }, []);


  // 4. Persistence Functions (Save/Load/New)
  const saveProject = useCallback(async (name) => {
    if (!dbInstance || !userId || !currentProjectId) return;
    setLoading(true);

    try {
      const projectDocRef = getProjectPath(currentProjectId);
      const projectData = {
        name: name || `Project ${currentProjectId}`,
        language: selectedLanguage,
        files: currentFiles,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: userId,
      };

      await setDoc(projectDocRef, projectData, { merge: true });
      setMessage(`Project '${projectData.name}' saved successfully!`);
    } catch (error) {
      console.error("Error saving project:", error);
      setMessage('Error saving project. Check console for details.');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  }, [dbInstance, userId, currentProjectId, currentFiles, selectedLanguage, getProjectPath]);

  const loadProject = useCallback(async (projectId) => {
    if (!dbInstance || !userId) return;
    setLoading(true);
    setMessage(`Loading project ${projectId}...`);

    try {
      const projectDocRef = getProjectPath(projectId);
      const docSnap = await getDoc(projectDocRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        
        const loadedLanguage = data.language || 'React.js';
        setSelectedLanguage(loadedLanguage);

        setCurrentFiles(data.files || getLangInitialFiles(loadedLanguage)); 
        setCurrentProjectId(projectId);
        
        const newPath = Object.keys(data.files).find(p => data.files[p].entry) || Object.keys(data.files).sort()[0] || '/src/App.js';
        setSelectedPath(newPath);
        
        setMessage(`Project '${data.name}' loaded. Language: ${loadedLanguage}`);
      } else {
        setMessage(`Project ID ${projectId} not found.`);
      }
    } catch (error) {
      console.error("Error loading project:", error);
      setMessage('Error loading project. Check console for details.');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  }, [dbInstance, userId, getProjectPath]);

  const newProject = useCallback(() => {
    setCurrentFiles(getLangInitialFiles(selectedLanguage));
    setSelectedPath(Object.keys(getLangInitialFiles(selectedLanguage)).find(p => getLangInitialFiles(selectedLanguage)[p].entry) || '/src/App.js');
    setCurrentProjectId(crypto.randomUUID());
    setMessage(`New ${selectedLanguage} project created. Use "Save" to persist.`);
  }, [selectedLanguage]);

  const deleteProject = useCallback(async (projectId) => {
    if (!dbInstance || !userId) return;
    setLoading(true);

    try {
        await deleteDoc(getProjectPath(projectId));
        setMessage(`Project ${projectId} deleted.`);
        if (currentProjectId === projectId) {
            newProject();
        }
    } catch (error) {
        console.error("Error deleting project:", error);
        setMessage('Error deleting project.');
    } finally {
        setLoading(false);
        setTimeout(() => setMessage(''), 3000);
    }
  }, [dbInstance, userId, currentProjectId, newProject, getProjectPath]);

  // Initial load/setup (auto-create a new project ID on startup)
  useEffect(() => {
    if (isAuthReady && !currentProjectId) {
        newProject();
    }
  }, [isAuthReady, currentProjectId, newProject]);

  // NEW: Autosave Implementation
  useEffect(() => {
    if (!isAuthReady || !currentProjectId || !isAutosaveEnabled) return;

    const intervalId = setInterval(() => {
      // Autosave runs silently, without setting loading or displaying messages
      const autosave = async () => {
        try {
          const projectDocRef = getProjectPath(currentProjectId);
          const projectData = {
            language: selectedLanguage,
            files: currentFiles,
            updatedAt: new Date().toISOString(),
          };
          await setDoc(projectDocRef, projectData, { merge: true });
        } catch (error) {
          console.error("Autosave failed:", error);
        }
      };
      autosave();
    }, 10000); // Autosave every 10 seconds

    return () => clearInterval(intervalId);
  }, [isAutosaveEnabled, isAuthReady, currentProjectId, currentFiles, selectedLanguage, getProjectPath]);


  return {
    currentFiles,
    setCurrentFiles, 
    selectedPath,
    setSelectedPath,
    currentProjectId,
    userId,
    isAuthReady,
    loading,
    message,
    saveProject,
    loadProject,
    newProject,
    deleteProject,
    updateFileContent,
    selectedLanguage,
    switchLanguage,
    isAutosaveEnabled,
    setIsAutosaveEnabled,
  };
};


// --- CONVERSION MODAL COMPONENT ---

/**
 * Custom Modal for Language Conversion Prompt
 */
const ConvertCodeModal = ({ isOpen, onClose, onConvert, currentLanguage, theme }) => {
    const [targetLanguage, setTargetLanguage] = useState(supportedConversionLangs[0]); // Default to first available
    const isDark = theme === 'dark';
    const modalBg = isDark ? 'bg-gray-800' : 'bg-white';
    const textColor = isDark ? 'text-white' : 'text-gray-900';
    const selectBg = isDark ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300';


    const handleConvert = () => {
        if (targetLanguage && targetLanguage !== currentLanguage) {
            onConvert(targetLanguage);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
            <div className={`${modalBg} rounded-xl shadow-2xl w-full max-w-sm p-6 border ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
                <h3 className={`text-2xl font-bold mb-4 ${textColor}`}>✨ Convert Language</h3>
                <p className={`mb-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Convert code from **{currentLanguage}** to:
                </p>
                
                <select
                    value={targetLanguage}
                    onChange={(e) => setTargetLanguage(e.target.value)}
                    className={`w-full p-3 rounded-lg border focus:ring-2 focus:ring-purple-500 focus:outline-none ${selectBg}`}
                >
                    {supportedConversionLangs
                        .filter(lang => lang !== currentLanguage)
                        .map(lang => (
                            <option key={lang} value={lang}>{lang}</option>
                        ))}
                </select>

                <div className="mt-6 flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className={`py-2 px-4 rounded-lg font-semibold ${isDark ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConvert}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                        disabled={!targetLanguage || targetLanguage === currentLanguage}
                    >
                        Convert to {targetLanguage}
                    </button>
                </div>
            </div>
        </div>
    );
};


/**
 * Custom Modal for Code Generation Prompt
 */
const GenerateCodeModal = ({ isOpen, onClose, onGenerate, theme }) => {
    const [prompt, setPrompt] = useState('');
    const isDark = theme === 'dark';
    const modalBg = isDark ? 'bg-gray-800' : 'bg-white';
    const inputBg = isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900';
    const textColor = isDark ? 'text-white' : 'text-gray-900';

    const handleGenerate = () => {
        if (prompt.trim()) {
            onGenerate(prompt);
            setPrompt('');
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
            <div className={`${modalBg} rounded-xl shadow-2xl w-full max-w-lg p-6 border ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
                <h3 className={`text-2xl font-bold mb-4 ${textColor}`}>✨ Generate Boilerplate Code</h3>
                <p className={`mb-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Describe the component, function, or file structure you want to generate.
                </p>
                
                <textarea
                    rows="4"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="E.g., 'A responsive React component with Tailwind CSS that displays a user profile card and handles dark mode state.'"
                    className={`w-full p-3 rounded-lg resize-none focus:ring-2 focus:ring-green-500 focus:outline-none ${inputBg}`}
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleGenerate();
                        }
                    }}
                />

                <div className="mt-6 flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className={`py-2 px-4 rounded-lg font-semibold ${isDark ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleGenerate}
                        className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                        disabled={!prompt.trim()}
                    >
                        Generate
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * Language Sidebar Component
 */
const LanguageSidebar = ({ selectedLanguage, switchLanguage, theme }) => {
    const isDark = theme === 'dark';
    const bgColor = isDark ? 'bg-gray-900' : 'bg-gray-100';
    const borderColor = isDark ? 'border-gray-700' : 'border-gray-300';
    const itemBg = isDark ? 'bg-gray-800' : 'bg-white';
    const itemHover = isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200';
    const itemText = isDark ? 'text-gray-400' : 'text-gray-600';
    const selectedBg = isDark ? 'bg-green-700' : 'bg-green-500';

    return (
        <div className={`w-20 ${bgColor} border-r ${borderColor} flex-shrink-0 overflow-y-auto p-1`}>
            {getLanguageKeys().map(langKey => {
                const config = LANGUAGE_CONFIGS[langKey];
                const isSelected = langKey === selectedLanguage;

                return (
                    <button
                        key={langKey}
                        onClick={() => switchLanguage(langKey)}
                        className={`w-full p-2 my-1 rounded-lg text-xs transition-colors duration-200 block text-center ${itemText} ${itemBg} ${itemHover} ${
                            isSelected ? `${selectedBg} !text-white shadow-lg` : ''
                        }`}
                        title={config.label}
                    >
                        <div className="text-xl mb-1">{config.icon}</div>
                        <span className="truncate block">{config.label}</span>
                    </button>
                );
            })}
        </div>
    );
};

/**
 * Component to handle file management actions (add, delete, rename)
 */
const FileManagement = ({ files, selectedPath, setSelectedPath, updateFiles, currentProjectId, userId, selectedLanguage, theme }) => {
    const [newFileName, setNewFileName] = useState('');
    const [renamePath, setRenamePath] = useState(null);
    const isDark = theme === 'dark';
    const fileText = isDark ? 'text-gray-300' : 'text-gray-700';
    const fileHoverBg = isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-300';
    const selectedBg = isDark ? 'bg-green-700/50' : 'bg-green-200';
    const sidebarBg = isDark ? 'bg-gray-900' : 'bg-gray-100';
    const fileActionsEnabled = LANGUAGE_CONFIGS[selectedLanguage]?.editable;


    // Filter file paths to only show non-hidden ones for the explorer
    const visiblePaths = useMemo(() => {
        return Object.keys(files).filter(path => !files[path].hidden).sort();
    }, [files]);

    // Use window.prompt replacement instead of alert()
    const alert = (message) => { console.warn('CipherStudio Alert:', message); }; 

    const handleCreate = () => {
        if (!fileActionsEnabled) {
            alert('File creation is only supported in editable environments (all languages are now editable, but an internal issue prevents file creation for this language).');
            return;
        }

        if (!newFileName || files[`/${newFileName}`]) return;

        const path = newFileName.startsWith('/') ? newFileName : `/${newFileName}`;
        const isFolder = path.endsWith('/');
        
        let defaultContent = null;
        if (!isFolder) {
            const ext = path.split('.').pop();
            // Assign some basic default content based on extension
            if (ext === 'css') {
                defaultContent = `/* ${path} */\n`;
            } else if (ext === 'js' || ext === 'jsx' || ext === 'ts' || ext === 'tsx') {
                defaultContent = `// ${path} \n\nexport default function Component() { return <div>Hello, ${path}</div>; }`;
            } else if (ext === 'html') {
                defaultContent = `<!-- ${path} -->\n<!DOCTYPE html>\n<html>\n<body>\n<h1>Hello HTML</h1>\n</body>\n</html>`;
            } else if (ext === 'py') {
                 defaultContent = `# ${path}\n\nprint("Hello from new Python file")\n`;
            } else if (ext === 'cpp') {
                 defaultContent = `// ${path}\n#include <iostream>\n\nint main() {\n  std::cout << "New C++ File" << std::endl;\n  return 0;\n}`;
            } else {
                defaultContent = `// ${path}\n\n`;
            }
        }

        updateFiles(prevFiles => ({
            ...prevFiles,
            [path]: { code: defaultContent, hidden: isFolder, folder: isFolder },
        }));

        setNewFileName('');
        if (!isFolder) setSelectedPath(path);
    };

    const confirmDelete = (path, callback) => {
        // Use a standard prompt since we can't rely on a custom modal here easily
        if (window.prompt(`Type "DELETE" to confirm deletion of ${path}:`) === 'DELETE') {
            callback();
        }
    };

    const handleDelete = (path) => {
        if (!fileActionsEnabled) {
            alert('File deletion is only supported in editable environments.');
            return;
        }
        confirmDelete(path, () => {
            updateFiles(prevFiles => {
                const newFiles = { ...prevFiles };
                delete newFiles[path];

                if (files[path] && files[path].folder) {
                    Object.keys(newFiles).forEach(p => {
                        if (p.startsWith(path)) {
                            delete newFiles[p];
                        }
                    });
                }
                if (selectedPath === path) {
                    const remainingPaths = Object.keys(newFiles).filter(p => newFiles[p].code !== null);
                    // Fallback to a sensible default if no file is left
                    setSelectedPath(remainingPaths.length > 0 ? remainingPaths[0] : Object.keys(getLangInitialFiles(selectedLanguage))[0] || '/src/App.js');
                }
                return newFiles;
            });
        });
    };
    
    const handleRename = (oldPath) => {
        if (!fileActionsEnabled) {
            alert('File renaming is only supported in editable environments.');
            return;
        }
        if (!renamePath || oldPath === renamePath) {
            setRenamePath(null); 
            return;
        }

        const newPath = renamePath.startsWith('/') ? renamePath : `/${renamePath}`;

        if (files[newPath]) {
            alert('File or folder already exists.'); 
            return;
        }
        
        if (files[oldPath].code === null && !newPath.endsWith('/')) {
            alert('Cannot rename a folder to a file path. Please add a trailing slash for folders.');
            return;
        }

        updateFiles(prevFiles => {
            const newFiles = {};
            Object.keys(prevFiles).forEach(path => {
                if (path === oldPath) {
                    newFiles[newPath] = prevFiles[path];
                } else if (path.startsWith(oldPath) && files[oldPath].folder) {
                    const relativePath = path.substring(oldPath.length);
                    newFiles[newPath + relativePath] = prevFiles[path];
                } else {
                    newFiles[path] = prevFiles[path];
                }
            });

            if (selectedPath === oldPath) setSelectedPath(newPath);
            setRenamePath(null);
            return newFiles;
        });
    };

    const FileTree = ({ paths }) => {
        const tree = {};

        paths.forEach(path => {
            const parts = path.substring(1).split('/').filter(p => p.length > 0);
            let current = tree;
            const fullPathSegments = [];

            parts.forEach((part, i) => {
                fullPathSegments.push(part);
                const currentPath = '/' + fullPathSegments.join('/');
                
                if (!current[part]) {
                    const isFile = (i === parts.length - 1) && files[path] && files[path].code !== null && !files[path].folder;

                    current[part] = { 
                        children: {}, 
                        path: currentPath, 
                        isFile: isFile 
                    };
                }
                current = current[part].children;
            });
        });

        const renderTree = (node) => (
            <ul className="pl-4">
                {Object.keys(node).sort().map(name => {
                    const item = node[name];
                    const path = item.path;
                    const isSelected = path === selectedPath;
                    const isFolder = Object.keys(item.children).length > 0 || (files[path] && files[path].folder);

                    // Simplified icon logic for non-web languages
                    let icon = isFolder ? '📁' : '📄';
                    if (path.endsWith('.js') || path.endsWith('.jsx') || path.endsWith('.ts') || path.endsWith('.tsx')) icon = '⚛️';
                    else if (path.endsWith('.css')) icon = '#';
                    else if (path.endsWith('.py')) icon = '🐍';
                    else if (path.endsWith('.java')) icon = '☕';
                    else if (path.endsWith('.cpp')) icon = 'C++';
                    else if (path.endsWith('.cs')) icon = 'C#';


                    const isRenderableFile = item.isFile || (files[path] && files[path].code !== null && !files[path].folder);


                    return (
                        <li key={path} className={`${fileText} group`}>
                            {/* File/Folder Display */}
                            <div className={`flex items-center space-x-2 p-1 rounded transition duration-150 cursor-pointer ${isSelected ? selectedBg : fileHoverBg}`}>
                                <span className="text-xs mr-2">{icon}</span>
                                {renamePath === path ? (
                                    <input
                                        type="text"
                                        value={renamePath}
                                        onChange={(e) => setRenamePath(e.target.value)}
                                        onBlur={() => handleRename(path)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleRename(path);
                                            if (e.key === 'Escape') setRenamePath(null);
                                        }}
                                        className={`${isDark ? 'bg-gray-800 text-white' : 'bg-white text-black'} flex-grow px-1`}
                                        autoFocus
                                        disabled={!fileActionsEnabled}
                                    />
                                ) : (
                                    <span
                                        className="flex-grow truncate"
                                        onClick={() => isRenderableFile && setSelectedPath(path)}
                                        onDoubleClick={() => fileActionsEnabled && setRenamePath(path)}
                                    >
                                        {name}
                                    </span>
                                )}

                                {/* Actions */}
                                <div className={`space-x-1 transition-opacity ${fileActionsEnabled ? 'opacity-0 group-hover:opacity-100' : 'opacity-20'}`}>
                                    <button
                                        onClick={() => handleDelete(path)}
                                        className="text-red-400 hover:text-red-500 text-xs p-1"
                                        title="Delete"
                                        disabled={!fileActionsEnabled}
                                    >
                                        &times;
                                    </button>
                                </div>
                            </div>

                            {/* Recursively render children */}
                            {isFolder && Object.keys(item.children).length > 0 && renderTree(item.children)}
                        </li>
                    );
                })}
            </ul>
        );

        return renderTree(tree);
    };

    return (
        <div className={`p-3 text-sm flex flex-col h-full overflow-y-auto ${sidebarBg}`}>
            <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'} border-b ${isDark ? 'border-gray-700' : 'border-gray-300'} pb-2`}>
                Files - ({selectedLanguage})
            </h2>
            <p className={`text-xs mb-2 ${fileActionsEnabled ? 'text-green-400' : 'text-red-400'}`}>
                {LANGUAGE_CONFIGS[selectedLanguage]?.description}
            </p>

            {/* Create New File/Folder Input */}
            <div className={`mb-4 flex space-x-1`}>
                <input
                    type="text"
                    placeholder="new-file.js or folder/"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    className={`flex-grow p-2 rounded focus:ring-2 focus:ring-green-500 focus:outline-none ${isDark ? 'bg-gray-800 text-white placeholder-gray-500' : 'bg-white text-gray-900 placeholder-gray-400'}`}
                />
                <button
                    onClick={handleCreate}
                    className="bg-green-600 hover:bg-green-700 text-white p-2 rounded"
                    title="Create File/Folder"
                >
                    +
                </button>
            </div>

            {/* File Tree Display */}
            <div className="flex-grow overflow-y-auto">
                <FileTree paths={visiblePaths} />
            </div>

            {/* User ID Display - Mandatory for collaborative apps */}
            <div className={`mt-4 pt-2 border-t ${isDark ? 'border-gray-700' : 'border-gray-300'} text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'} truncate`}>
                User ID: <span className="font-mono">{userId}</span>
                <span className="block">Project ID: <span className="font-mono">{currentProjectId?.substring(0, 8) + '...'}</span></span>
            </div>
        </div>
    );
};


/**
 * Toolbar component for project management (New, Save, Load) and AI Tools.
 */
const Toolbar = ({ currentProjectId, saveProject, newProject, loadProject, loading, message, deleteProject, explainCode, reviewCode, showGenerateModal, showConvertModal, theme, toggleTheme, isAutosaveEnabled, toggleAutosave }) => {
    const [loadInput, setLoadInput] = useState('');
    const [projectName, setProjectName] = useState(`Project ${currentProjectId?.substring(0, 8) || ''}`);
    const isDark = theme === 'dark';
    const toolbarBg = isDark ? 'bg-gray-900' : 'bg-gray-200';
    const toolbarBorder = isDark ? 'border-gray-700' : 'border-gray-300';
    const textColor = isDark ? 'text-white' : 'text-gray-900';
    const inputBg = isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900';

    useEffect(() => {
        setProjectName(`Project ${currentProjectId?.substring(0, 8) || ''}`);
    }, [currentProjectId]);

    const handleSave = () => {
        if (projectName) {
            saveProject(projectName);
        } else {
            console.warn('CipherStudio Alert: Please enter a project name.');
        }
    };

    return (
        <div className={`p-3 ${toolbarBg} border-b ${toolbarBorder} flex items-center justify-between ${textColor} shadow-lg flex-wrap gap-2`}>
            <div className="flex items-center space-x-4">
                <h1 className="text-xl font-bold text-green-500">CipherStudio</h1>

                <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className={`${inputBg} p-1 rounded text-sm w-48 focus:ring-green-500 focus:ring-1`}
                    placeholder="Project Name"
                    disabled={loading}
                />
            </div>

            <div className="flex items-center space-x-4 flex-grow justify-end min-w-[500px]">
                {/* Status Message */}
                <div className="text-sm text-yellow-500 min-w-[150px] text-right">
                    {loading ? 'Processing...' : message}
                </div>
                
                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    className={`p-2 rounded transition duration-200 ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-300'} ${isDark ? 'text-yellow-400' : 'text-gray-800'}`}
                    title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                    {isDark ? '☀️' : '🌙'}
                </button>

                {/* Autosave Toggle */}
                <button
                    onClick={toggleAutosave}
                    className={`py-2 px-3 rounded text-sm transition duration-200 flex items-center space-x-1 font-semibold ${isAutosaveEnabled ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-gray-500 hover:bg-gray-600 text-white'}`}
                    title={isAutosaveEnabled ? "Autosave is ON (every 10s)" : "Autosave is OFF"}
                >
                    <span className="text-lg">💾</span>
                    <span>Autosave {isAutosaveEnabled ? 'ON' : 'OFF'}</span>
                </button>
                
                {/* AI Actions */}
                <button
                    onClick={explainCode}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-3 rounded text-sm transition duration-200 flex items-center space-x-1"
                    disabled={loading}
                    title="Get a plain-language explanation of the current file's code."
                >
                    <span className="text-lg">✨</span>
                    <span>Explain Code</span>
                </button>
                <button
                    onClick={reviewCode}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 px-3 rounded text-sm transition duration-200 flex items-center space-x-1"
                    disabled={loading}
                    title="Review the code and suggest refactoring or improvements."
                >
                    <span className="text-lg">✨</span>
                    <span>Review & Refactor</span>
                </button>
                <button
                    onClick={showGenerateModal}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-3 rounded text-sm transition duration-200 flex items-center space-x-1"
                    disabled={loading}
                    title="Generate boilerplate code from a natural language description."
                >
                    <span className="text-lg">✨</span>
                    <span>Generate Code</span>
                </button>
                 <button
                    onClick={showConvertModal}
                    className="bg-pink-600 hover:bg-pink-700 text-white font-semibold py-2 px-3 rounded text-sm transition duration-200 flex items-center space-x-1"
                    disabled={loading}
                    title="Convert code from the current language to another programming language."
                >
                    <span className="text-lg">✨</span>
                    <span>Convert Language</span>
                </button>

                {/* Persistence Actions */}
                <button
                    onClick={newProject}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded text-sm transition duration-200"
                    disabled={loading}
                >
                    New Project
                </button>
                <button
                    onClick={handleSave}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-3 rounded text-sm transition duration-200"
                    disabled={loading}
                >
                    Save
                </button>
            </div>

            {/* Load/Delete Section */}
            <div className="flex items-center space-x-2 mt-2 md:mt-0">
                <input
                    type="text"
                    value={loadInput}
                    onChange={(e) => setLoadInput(e.target.value)}
                    className={`${inputBg} p-1 rounded text-sm w-32 focus:ring-green-500 focus:ring-1`}
                    placeholder="Project ID to load"
                />
                <button
                    onClick={() => loadProject(loadInput)}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 px-3 rounded text-sm transition duration-200"
                    disabled={loading || !loadInput}
                >
                    Load
                </button>
                <button
                    onClick={() => deleteProject(loadInput)}
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-3 rounded text-sm transition duration-200"
                    disabled={loading || !loadInput}
                >
                    Delete
                </button>
            </div>
        </div>
    );
};

/**
 * Custom Code Editor wrapper (using native textarea)
 */
const CipherEditor = ({ selectedPath, fileContent, updateFileContent, selectedLanguage, theme }) => {
    // Determine the language for syntax highlighting (visually only)
    const language = useMemo(() => {
        if (selectedPath.endsWith('.js') || selectedPath.endsWith('.jsx')) return 'javascript';
        if (selectedPath.endsWith('.ts') || selectedPath.endsWith('.tsx')) return 'typescript';
        if (selectedPath.endsWith('.css')) return 'css';
        if (selectedPath.endsWith('.html')) return 'html';
        return 'text';
    }, [selectedPath]);
    
    // All languages are now editable
    const isEditable = LANGUAGE_CONFIGS[selectedLanguage]?.editable;
    const isDark = theme === 'dark';
    const editorBg = isDark ? 'bg-gray-800' : 'bg-white';
    const editorText = isDark ? 'text-white' : 'text-gray-900';
    const tabBg = isDark ? 'bg-gray-900' : 'bg-gray-200';
    const tabItemBg = isDark ? 'bg-gray-700' : 'bg-gray-300';
    const tabBorder = isDark ? 'border-gray-700' : 'border-gray-300';

    return (
        <div className={`flex flex-col h-full ${editorBg} ${editorText} text-sm relative`}>
            {/* Tab Bar (Simulated) */}
            <div className={`p-2 ${tabBg} border-b ${tabBorder} text-xs flex items-center justify-between`}>
                <span className={`${tabItemBg} px-3 py-1 rounded-t border-b-2 border-green-500 flex items-center`}>
                    <span className="text-xs mr-2">
                        {language === 'javascript' || language === 'typescript' ? '⚛️' : language === 'css' ? '#' : '📄'}
                    </span>
                    {selectedPath}
                </span>
                {/* Removed Read-Only message since the code editor is now universally editable */}
            </div>

            {/* Code Editor Area */}
            <div className="flex flex-1 overflow-hidden">
                <textarea
                    key={selectedPath} 
                    value={fileContent || ''}
                    onChange={(e) => isEditable && updateFileContent(selectedPath, e.target.value)}
                    spellCheck="false"
                    // Removed the opacity/cursor-not-allowed classes as the editor is always active now
                    className={`flex-1 resize-none font-mono text-sm p-4 h-full outline-none leading-relaxed ${editorBg} ${editorText}`}
                    // Disabled prop is now effectively always false
                />
            </div>
            
            <style jsx="true">{`
                .line-number {
                    display: inline-block;
                    width: 30px;
                    text-align: right;
                    margin-right: 10px;
                    color: ${isDark ? '#555' : '#aaa'};
                }
            `}</style>
        </div>
    );
};

// --- REACT LIVE RENDERING SIMULATION ---

/**
 * Renders a static version of the starter React component. 
 * THIS IS THE FIX. We stop trying to compile JSX dynamically and just show the static starter app.
 */
const StaticReactPreview = React.memo(({ theme }) => {
    const previewBg = theme === 'dark' ? 'bg-gray-900' : 'bg-white';
    const previewText = theme === 'dark' ? 'text-white' : 'text-gray-900';
    
    // Since we cannot compile the user's JSX, we render a static pre-compiled component instead.
    // The user's code changes will NOT affect this live, but it removes the critical JSX error.
    const [count, setCount] = useState(0);

    const increment = () => {
        setCount(c => c + 1);
    };
    
    return (
        <div className={`flex flex-col items-center justify-center p-4 min-h-full w-full ${previewBg} ${previewText}`}>
            <h1 className="text-3xl font-bold mb-4 text-green-500">CipherStudio Static React Preview</h1>
            <p className="text-xl mb-6">Count: {count}</p>
            <button onClick={increment} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 shadow-md">
                Increment
            </button>
            <p className="mt-8 text-sm text-gray-500">
                **Note:** Live updates are disabled to prevent compilation errors.
            </p>
        </div>
    );
});
StaticReactPreview.displayName = 'StaticReactPreview';


/**
 * Logic to get Simulated Terminal Output from Gemini
 */
const useTerminalSimulation = (selectedLanguage, codeDumpContent, isLiveLang, callGeminiApi) => {
    const [simulatedOutput, setSimulatedOutput] = useState(null);
    const [simLoading, setSimLoading] = useState(false);

    // Basic local simulation for simple cases
    const simulateLocally = useCallback((code, lang) => {
        try {
            // Handle different languages
            if (lang === 'JavaScript' || lang === 'React.js') {
                const matches = code.match(/console\.log\(['"](.*?)['"]\)/);
                if (matches) return matches[1];
            }
            if (lang === 'Python') {
                const matches = code.match(/print\(['"](.*?)['"]\)/);
                if (matches) return matches[1];
            }
            return "[Local Preview] Basic output simulation active";
        } catch (e) {
            return "[Local Preview] Cannot parse output";
        }
    }, []);

    // Debounce the call to avoid hitting the API too frequently while typing
    const debouncedCallGemini = useCallback((code, lang) => {
        if (!code || isLiveLang) return; // Only simulate non-live code

        // Clear previous timeout if it exists
        const handler = setTimeout(() => {
            setSimLoading(true);
            
            // Try local simulation first
            try {
                const localOutput = simulateLocally(code, lang);
                if (localOutput) {
                    setSimulatedOutput(localOutput);
                    setSimLoading(false);
                    return;
                }
            } catch (e) {
                console.warn('Local simulation failed:', e);
            }

            // If local simulation didn't work, try API
            const systemInstruction = `You are a terminal emulator for ${lang}. Given the user's code, execute it mentally and provide the console output. Respond with ONLY the expected terminal output text. Do not provide code blocks, explanations, or commentary. If the code is complex, multi-file, or requires user input, respond with "Simulation too complex or interactive. Cannot determine output."`;
            
            callGeminiApi(
                `Simulate the console output for the following ${lang} code:\n\n\`\`\`${lang}\n${code}\n\`\`\``,
                systemInstruction,
                'Terminal Simulation'
            ).then(result => {
                setSimulatedOutput(result); 
                setSimLoading(false);
            }).catch(e => {
                console.warn('API simulation failed, using local mode:', e);
                const localFallback = simulateLocally(code, lang);
                setSimulatedOutput(localFallback || "[Local Preview] Basic output simulation active");
                setSimLoading(false);
            });
        }, 1500); // 1.5 second debounce

        return () => clearTimeout(handler);
    }, [isLiveLang, callGeminiApi]);
    
    // Effect to trigger simulation when code changes
    useEffect(() => {
        if (!isLiveLang && codeDumpContent) {
            // Note: We need to use a proxy call to callGeminiApi here
            // This is complex due to hooks, so we'll simplify and use a flag/state
            // to signal the main component to call the API instead of calling it here.
            
            // For now, we will simply rely on the debounced function, but we need
            // a mechanism to handle the loading state/output outside the hook.
            // Since we need to use the full `callGeminiApi`, we rely on it being passed down.
            
            return debouncedCallGemini(codeDumpContent, selectedLanguage);
        } else {
            setSimulatedOutput(null);
        }
    }, [selectedLanguage, codeDumpContent, isLiveLang, debouncedCallGemini]);

    return { simulatedOutput, simLoading };
};


/**
 * Preview Panel (Handles HTML rendering and Code Dumping)
 */
const CipherPreview = ({ files, selectedLanguage, theme, callGeminiApi }) => {
    
    const isReact = selectedLanguage === 'React.js';
    const isHTML = selectedLanguage === 'HTML';
    const isSimulated = !isReact && !isHTML; // Non-web languages require simulation

    const isDark = theme === 'dark';
    const panelBg = isDark ? 'bg-gray-800' : 'bg-white';
    const codeBg = isDark ? 'bg-gray-700' : 'bg-gray-100';
    const codeText = isDark ? 'text-gray-100' : 'text-gray-800';

    // 1. Get relevant file content
    const appJsCode = files['/src/App.js']?.code || '';
    const mainHtmlContent = files['/index.html']?.code || '';
    
    // 2. Get content for code dump (main entry point)
    const codeDumpContent = useMemo(() => {
        const entryPath = Object.keys(files).find(p => files[p].entry) || Object.keys(files).sort()[0];
        return files[entryPath]?.code || '// Preview content not available.';
    }, [files]);
    
    // --- NEW: LLM-based Terminal Output Simulation ---
    const [simulatedOutput, setSimulatedOutput] = useState(null);
    const [simLoading, setSimLoading] = useState(false);
    const [lastSimulatedCode, setLastSimulatedCode] = useState('');
    
    // Debounced function to call the AI for execution simulation
    const debouncedSimulate = useCallback((code, lang) => {
        setSimLoading(true);
        setSimulatedOutput('Thinking...');

        const systemInstruction = `You are a terminal emulator for ${lang}. Given the user's code, execute it mentally and provide the console output. Respond with ONLY the expected terminal output text. Do not provide code blocks, explanations, or commentary. If the code is complex, multi-file, or requires user input, respond with "Simulation too complex or interactive. Cannot determine output."`;
        
        callGeminiApi(
            `Simulate the console output for the following ${lang} code:\n\n\`\`\`${lang}\n${code}\n\`\`\``,
            systemInstruction,
            'Terminal Simulation'
        ).then(result => {
            // result is the full text output from the API
            setSimulatedOutput(result); 
            setSimLoading(false);
            setLastSimulatedCode(code);
        }).catch(e => {
            setSimulatedOutput(`[Simulation Error] Failed to contact AI helper: ${e.message}`);
            setSimLoading(false);
        });
    }, [callGeminiApi]);

    // Effect to trigger simulation when code changes (using debounce)
    useEffect(() => {
        if (!isSimulated) return; // Skip for React/HTML
        
        // This is a simple deep-equality check for large strings to prevent unnecessary calls
        if (codeDumpContent === lastSimulatedCode) return;
        
        const handler = setTimeout(() => {
            if (codeDumpContent.trim().length > 5) {
                debouncedSimulate(codeDumpContent, selectedLanguage);
            } else {
                setSimulatedOutput('');
                setLastSimulatedCode('');
            }
        }, 1500); 

        return () => clearTimeout(handler);
    }, [codeDumpContent, selectedLanguage, isSimulated, debouncedSimulate, lastSimulatedCode]);
    // --- END: LLM-based Terminal Output Simulation ---


    let PreviewContent;
    let previewTitle;
    let previewWarning;

    if (isReact) {
        // ** STATIC REACT PREVIEW (FIX) **
        PreviewContent = <StaticReactPreview theme={theme} />;
        previewTitle = 'Static React App Output';
        previewWarning = 'Live updates are disabled.';
    } else if (isHTML) {
        // ** LIVE HTML PREVIEW **
        PreviewContent = (
            <div 
                className="w-full h-full overflow-auto p-4"
                dangerouslySetInnerHTML={{ __html: mainHtmlContent }} 
            />
        );
        previewTitle = 'Live HTML Output';
        previewWarning = 'Rendering raw HTML content.';
    } else {
        // ** TERMINAL OUTPUT SIMULATION (NEW) **
        PreviewContent = (
            <div className={`absolute inset-0 ${codeBg} p-4 overflow-auto rounded-lg shadow-inner flex flex-col`}>
                <h2 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Terminal Output Simulation
                </h2>
                <p className='text-yellow-500 mb-4 text-xs'>
                    **NOTE:** Live execution is not available. Output is simulated by the Gemini AI helper.
                </p>
                
                <div className={`flex-1 p-2 ${isDark ? 'bg-black text-green-400' : 'bg-gray-900 text-green-300'} rounded-lg font-mono text-sm overflow-auto`}>
                    {simLoading ? (
                         <div className="flex items-center text-yellow-400">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400 mr-2"></div>
                            Compiling and Running...
                        </div>
                    ) : (
                        simulatedOutput || `> Ready to simulate ${selectedLanguage} code. Start typing to see the output here.`
                    )}
                </div>
            </div>
        );
        previewTitle = 'Compiler Output Simulation';
        previewWarning = `Simulated by AI for ${selectedLanguage}`;
    }


    return (
        <div className="flex flex-col h-full">
            <div className={`p-2 ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-200 border-gray-300'} border-b text-gray-400 text-xs flex justify-between`}>
                <span>{previewTitle}</span>
                <span className={isReact || isHTML ? 'text-green-500' : 'text-yellow-500'}>{previewWarning}</span>
            </div>
            
            <div className={`flex-1 ${panelBg} p-0 overflow-auto text-gray-800 font-mono text-sm relative`}>
                {PreviewContent}
            </div>
        </div>
    );
};


/**
 * Dedicated panel to display Gemini LLM responses.
 */
const AiOutputPanel = ({ aiOutput, aiLoading, aiToolMessage, theme }) => {
    const isDark = theme === 'dark';
    const panelBg = isDark ? 'bg-gray-700' : 'bg-gray-100';
    const text = isDark ? 'text-gray-100' : 'text-gray-900';
    const tabBg = isDark ? 'bg-gray-900' : 'bg-gray-200';
    const tabBorder = isDark ? 'border-gray-700' : 'border-gray-300';


    return (
        <div className="flex flex-col h-full">
            <div className={`p-2 ${tabBg} border-b ${tabBorder} text-gray-400 text-xs flex justify-between`}>
                <span>✨ AI Assistant Console</span>
                <span className="text-purple-400">{aiToolMessage}</span>
            </div>
            
            <div className={`flex-1 ${panelBg} p-4 overflow-auto relative`}>
                {aiLoading ? (
                    <div className="flex items-center justify-center h-full text-purple-500">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mr-3"></div>
                        Generating AI Response...
                    </div>
                ) : aiOutput ? (
                    <pre className={`whitespace-pre-wrap font-mono text-sm leading-relaxed ${text}`}>
                        {aiOutput}
                    </pre>
                ) : (
                    <div className="text-gray-500 text-center p-10">
                        Use the ✨ buttons in the toolbar to explain or review your code.
                    </div>
                )}
            </div>
        </div>
    );
};

/**
 * Main application component for CipherStudio IDE.
 */
const App = () => {
    // Theme State
    const [theme, setTheme] = useState('dark');
    const toggleTheme = useCallback(() => {
        setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
    }, []);

    // 1. Project Management Hook
    const {
        currentFiles,
        setCurrentFiles, 
        selectedPath,
        setSelectedPath,
        currentProjectId,
        userId,
        isAuthReady,
        loading,
        message,
        updateFileContent,
        saveProject,
        loadProject,
        newProject,
        deleteProject,
        selectedLanguage, 
        switchLanguage,
        isAutosaveEnabled,
        setIsAutosaveEnabled,
    } = useProjectManager(db, auth); 

    const toggleAutosave = useCallback(() => {
        setIsAutosaveEnabled(prev => !prev);
    }, [setIsAutosaveEnabled]);

    // 2. AI Tool State and Logic
    const [aiOutput, setAiOutput] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiToolMessage, setAiToolMessage] = useState('');
    const [activeRightPanel, setActiveRightPanel] = useState('preview');
    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
    const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);

    // Get the content of the currently selected file for the editor
    const activeFileContent = currentFiles[selectedPath]?.code || '// File not found or is a folder.';
    
    // Get the content of the "main" file for the simulated preview
    const previewFiles = useMemo(() => {
        // Pass the entire file map for React/HTML to look up necessary files
        return currentFiles;
    }, [currentFiles]);


    const callGeminiApi = useCallback(async (prompt, systemInstruction, toolName) => {
        setAiLoading(true);
        // Note: We deliberately DO NOT reset aiOutput/activeRightPanel here 
        // to allow simultaneous calls (e.g., Terminal Simulation and an explicit AI Tool).
        // The individual components manage their own loading/output states.

        const apiKey = "YOUR_API_KEY"; 
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: {
                parts: [{ text: systemInstruction }]
            },
        };

        let attempts = 0;
        const maxAttempts = 3;
        let lastError = null;

        while (attempts < maxAttempts) {
            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`API returned status ${response.status}`);
                }

                const result = await response.json();
                const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "Could not generate content.";
                
                // Only reset the main AI tool panel state if it was an explicit tool call
                if (toolName !== 'Terminal Simulation') {
                    setAiLoading(false);
                    setAiOutput(text);
                    setAiToolMessage(`Output for ${toolName} on ${selectedPath}`);
                }
                
                return text;

            } catch (error) {
                lastError = error;
                attempts++;
                const delay = Math.pow(2, attempts) * 1000;
                console.warn(`Attempt ${attempts} failed. Retrying in ${delay / 1000}s...`, error);
                if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        const finalError = `Failed to get a response after ${maxAttempts} attempts. Error: ${lastError.message || 'Unknown error'}`;
        
        if (toolName !== 'Terminal Simulation') {
            setAiLoading(false);
            setAiOutput(finalError);
            setAiToolMessage(`Failed to run ${toolName}`);
        }
        
        throw new Error(finalError);

    }, [selectedPath]);


    const explainCode = useCallback(async () => {
        const systemInstruction = `You are a helpful programming tutor. Your task is to analyze the provided code snippet written in ${selectedLanguage} and explain its purpose, key components, and function flow in clear, easy-to-understand language. Focus on the context (${selectedLanguage}/${selectedPath}) and be concise.`;
        const prompt = `Explain the following code from file ${selectedPath}:\n\n\`\`\`${activeFileContent}\`\`\``;
        await callGeminiApi(prompt, systemInstruction, 'Code Explanation');
    }, [activeFileContent, selectedPath, selectedLanguage, callGeminiApi]);

    const reviewCode = useCallback(async () => {
        const systemInstruction = `You are an expert code reviewer specializing in modern ${selectedLanguage} and software best practices. Analyze the provided code for potential improvements, bugs, or refactoring suggestions. Your response should be structured with markdown bullet points and code examples where applicable. If no issues are found, state "Code looks great! Ready for commit."`;
        const prompt = `Review the following code from file ${selectedPath} in ${selectedLanguage} and suggest improvements:\n\n\`\`\`${activeFileContent}\`\`\``;
        await callGeminiApi(prompt, systemInstruction, 'Code Review');
    }, [activeFileContent, selectedPath, selectedLanguage, callGeminiApi]);
    
    const generateCode = useCallback(async (description) => {
        const systemInstruction = `You are a top-tier software engineer specializing in ${selectedLanguage}. Generate a complete, self-contained code snippet based on the user's description. Enclose the code in a single markdown code block (e.g., \`\`\`${selectedLanguage}...\`\`\`). Do not include any text outside the markdown code block.`;
        const prompt = `Generate code for the following in ${selectedLanguage}, suitable for file ${selectedPath}: ${description}`;
        await callGeminiApi(prompt, systemInstruction, 'Code Generation');
    }, [selectedPath, selectedLanguage, callGeminiApi]);

    const convertCode = useCallback(async (targetLang) => {
        const systemInstruction = `You are an expert code translator. Your task is to accurately convert the provided code from ${selectedLanguage} to ${targetLang}. The output must contain ONLY the converted code snippet, enclosed in a single markdown code block (e.g., \`\`\`${targetLang}...\`\`\`). Do not include any explanatory text or commentary outside the markdown block.`;
        const prompt = `Convert the following code from ${selectedLanguage} to ${targetLang}:\n\n\`\`\`${activeFileContent}\`\`\``;
        await callGeminiApi(prompt, systemInstruction, `Code Conversion to ${targetLang}`);
    }, [activeFileContent, selectedLanguage, callGeminiApi]);


    // Effect to reset AI panel when file changes
    useEffect(() => {
        if (activeRightPanel === 'ai_tools' && !aiLoading) {
            setAiOutput(null);
            setAiToolMessage('');
        }
    }, [selectedPath, activeRightPanel, aiLoading]);


    // Handle initial loading state
    if (!isAuthReady) {
        return (
            <div className="flex items-center justify-center h-screen w-full bg-gray-900 text-white">
                <p>Initializing CipherStudio and connecting to Persistence...</p>
            </div>
        );
    }

    const mainBg = theme === 'dark' ? 'bg-gray-800' : 'bg-gray-200';

    return (
        <div className={`flex flex-col h-screen w-full font-sans ${mainBg} ${theme}`}>
            {/* AI Modals */}
            <GenerateCodeModal 
                isOpen={isGenerateModalOpen}
                onClose={() => setIsGenerateModalOpen(false)}
                onGenerate={generateCode}
                theme={theme}
            />
            <ConvertCodeModal
                isOpen={isConvertModalOpen}
                onClose={() => setIsConvertModalOpen(false)}
                onConvert={convertCode}
                currentLanguage={selectedLanguage}
                theme={theme}
            />

            {/* Toolbar for Project Actions and AI Tools */}
            <Toolbar
                currentProjectId={currentProjectId}
                saveProject={saveProject}
                loadProject={loadProject}
                newProject={newProject}
                deleteProject={deleteProject}
                loading={loading || aiLoading}
                message={message}
                explainCode={explainCode}
                reviewCode={reviewCode}
                showGenerateModal={() => setIsGenerateModalOpen(true)}
                showConvertModal={() => setIsConvertModalOpen(true)}
                theme={theme}
                toggleTheme={toggleTheme}
                isAutosaveEnabled={isAutosaveEnabled}
                toggleAutosave={toggleAutosave}
            />

            <div className="flex flex-1 overflow-hidden">
                {/* 1. Language Sidebar */}
                <LanguageSidebar 
                    selectedLanguage={selectedLanguage}
                    switchLanguage={switchLanguage}
                    theme={theme}
                />

                {/* 2. File Explorer Sidebar */}
                <div className="w-64 flex-shrink-0 overflow-y-auto">
                    <FileManagement
                        files={currentFiles}
                        selectedPath={selectedPath}
                        setSelectedPath={setSelectedPath}
                        updateFiles={setCurrentFiles} 
                        currentProjectId={currentProjectId}
                        userId={userId}
                        selectedLanguage={selectedLanguage}
                        theme={theme}
                    />
                </div>

                {/* 3. IDE Layout (Editor + Dynamic Right Panel) */}
                <div className="flex-1 overflow-hidden flex">
                    {/* Code Editor */}
                    <div className="flex-1 h-full border-r border-gray-700">
                        <CipherEditor
                            selectedPath={selectedPath}
                            fileContent={activeFileContent}
                            updateFileContent={updateFileContent}
                            selectedLanguage={selectedLanguage}
                            theme={theme}
                        />
                    </div>

                    {/* Right Panel: Tabbed Preview/AI Tools */}
                    <div className="flex-1 h-full flex flex-col">
                        {/* Tab Buttons */}
                        <div className={`flex ${theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-gray-200 border-gray-300'} border-b`}>
                            <button
                                onClick={() => setActiveRightPanel('preview')}
                                className={`px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                                    activeRightPanel === 'preview'
                                        ? `${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-300 text-gray-900'} border-b-2 border-green-500`
                                        : `${theme === 'dark' ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-300'}`
                                }`}
                            >
                                Preview
                            </button>
                            <button
                                onClick={() => setActiveRightPanel('ai_tools')}
                                className={`px-4 py-2 text-sm font-medium transition-colors duration-200 flex items-center ${
                                    activeRightPanel === 'ai_tools'
                                        ? `${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-300 text-gray-900'} border-b-2 border-purple-500`
                                        : `${theme === 'dark' ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-300'}`
                                }`}
                            >
                                ✨ AI Tools
                            </button>
                        </div>

                        {/* Panel Content */}
                        <div className="flex-1">
                            {activeRightPanel === 'preview' ? (
                                <CipherPreview
                                    files={previewFiles}
                                    selectedLanguage={selectedLanguage}
                                    theme={theme}
                                    callGeminiApi={callGeminiApi}
                                />
                            ) : (
                                <AiOutputPanel
                                    aiOutput={aiOutput}
                                    aiLoading={aiLoading}
                                    aiToolMessage={aiToolMessage}
                                    theme={theme}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default App;
