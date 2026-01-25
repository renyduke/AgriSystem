// // VegetableManagement.jsx
// import React, { useState, useEffect } from "react";
// import { supabase } from "../../supabase/supabaseClient"; // Supabase client import

// // Use react-icons/fa instead of fa6 for better compatibility
// import {
//   FaPlus,
//   FaTrash,
//   FaEdit,
//   FaSearch,
//   FaLeaf,
//   FaCheckCircle,
//   FaTimesCircle,
//   FaSync,
//   FaHistory,
//   FaUser,
//   FaFilter,
//   FaSpinner,
//   FaCloud,
//   FaCloudUploadAlt,
//   FaCloudOff,
//   FaDatabase,
//   FaExclamationTriangle,
//   FaSave,
//   FaChevronLeft,
//   FaChevronRight,
//   FaCalendarAlt,
//   FaInfoCircle,
//   FaTimes,
// } from "react-icons/fa";

// // Alternative: Import from specific sets if needed
// // import { FaCloudOff, FaCloudUploadAlt } from "react-icons/fa";
// // import { FaLeaf } from "react-icons/fa";

// const VegetableManagement = () => {
//   // State Management
//   const [vegetables, setVegetables] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [currentUser, setCurrentUser] = useState("");
//   const [showAddForm, setShowAddForm] = useState(false);
//   const [showEditForm, setShowEditForm] = useState(false);
//   const [showActivities, setShowActivities] = useState(false);
  
//   // Form States
//   const [newVegetableName, setNewVegetableName] = useState("");
//   const [editingVegetable, setEditingVegetable] = useState(null);
//   const [editVegetableName, setEditVegetableName] = useState("");
  
//   // Search and Filter States
//   const [searchTerm, setSearchTerm] = useState("");
//   const [filterActive, setFilterActive] = useState("all");
//   const [sortBy, setSortBy] = useState("name"); // "name", "created_at", "updated_at"
//   const [sortOrder, setSortOrder] = useState("asc"); // "asc", "desc"
  
//   // Activities and Sync States
//   const [activities, setActivities] = useState([]);
//   const [isLoadingActivities, setIsLoadingActivities] = useState(false);
//   const [isOnline, setIsOnline] = useState(true);
//   const [pendingSync, setPendingSync] = useState([]);
//   const [showOfflineAlert, setShowOfflineAlert] = useState(false);
  
//   // Pagination States
//   const [currentPage, setCurrentPage] = useState(1);
//   const [itemsPerPage, setItemsPerPage] = useState(10);
//   const [totalItems, setTotalItems] = useState(0);
  
//   // Notification States
//   const [showSuccess, setShowSuccess] = useState(false);
//   const [successMessage, setSuccessMessage] = useState("");
//   const [showError, setShowError] = useState(false);
//   const [errorMessage, setErrorMessage] = useState("");
//   const [showConfirmDelete, setShowConfirmDelete] = useState(false);
//   const [itemToDelete, setItemToDelete] = useState(null);

//   // Load current user from localStorage
//   useEffect(() => {
//     const loadUser = async () => {
//       try {
//         const userStr = localStorage.getItem("currentUser") || "Admin";
//         const user = JSON.parse(userStr)?.username || userStr;
//         setCurrentUser(user);
        
//         // Try to get user from Supabase auth
//         const { data: { user: supabaseUser } } = await supabase.auth.getUser();
//         if (supabaseUser) {
//           setCurrentUser(supabaseUser.email || supabaseUser.id);
//         }
//       } catch (error) {
//         console.error("Error loading user:", error);
//         setCurrentUser("Guest");
//       }
//     };
    
//     loadUser();
//   }, []);

//   // Network status monitoring
//   useEffect(() => {
//     const handleOnline = () => {
//       setIsOnline(true);
//       setShowOfflineAlert(false);
//       syncPendingChanges();
//     };
    
//     const handleOffline = () => {
//       setIsOnline(false);
//       setShowOfflineAlert(true);
//       setTimeout(() => setShowOfflineAlert(false), 5000);
//     };

//     window.addEventListener("online", handleOnline);
//     window.addEventListener("offline", handleOffline);

//     setIsOnline(navigator.onLine);

//     return () => {
//       window.removeEventListener("online", handleOnline);
//       window.removeEventListener("offline", handleOffline);
//     };
//   }, []);

//   // Load vegetables when dependencies change
//   useEffect(() => {
//     loadVegetables();
//     loadActivities();
//   }, [filterActive, currentPage, itemsPerPage, sortBy, sortOrder]);

//   // Load vegetables from Supabase
//   const loadVegetables = async () => {
//     setLoading(true);
//     try {
//       let query = supabase
//         .from("vegetables_list")
//         .select("*", { count: "exact" });

//       // Apply filters
//       if (filterActive === "active") {
//         query = query.eq("is_active", true);
//       } else if (filterActive === "inactive") {
//         query = query.eq("is_active", false);
//       }

//       // Apply search
//       if (searchTerm.trim() !== "") {
//         query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
//       }

//       // Apply sorting
//       if (sortBy === "name") {
//         query = query.order("name", { ascending: sortOrder === "asc" });
//       } else if (sortBy === "created_at") {
//         query = query.order("created_at", { ascending: sortOrder === "asc" });
//       } else if (sortBy === "updated_at") {
//         query = query.order("updated_at", { ascending: sortOrder === "asc" });
//       }

//       // Apply pagination
//       const from = (currentPage - 1) * itemsPerPage;
//       const to = from + itemsPerPage - 1;
      
//       const { data, error, count } = await query.range(from, to);

//       if (error) throw error;

//       setVegetables(data || []);
//       setTotalItems(count || 0);
      
//       // Load pending sync items
//       const pending = JSON.parse(localStorage.getItem("pending_vegetables") || "[]");
//       setPendingSync(pending);
//     } catch (error) {
//       console.error("Error loading vegetables:", error);
//       showNotification("error", "Failed to load vegetables");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Load activities from Supabase
//   const loadActivities = async () => {
//     setIsLoadingActivities(true);
//     try {
//       const { data, error } = await supabase
//         .from("vegetable_activities")
//         .select("*")
//         .order("timestamp", { ascending: false })
//         .limit(10);

//       if (error) throw error;
      
//       setActivities(data || []);
//     } catch (error) {
//       console.error("Error loading activities:", error);
//       // Fallback to local activities
//       const localActivities = JSON.parse(localStorage.getItem("local_activities") || "[]");
//       setActivities(localActivities.slice(0, 10));
//     } finally {
//       setIsLoadingActivities(false);
//     }
//   };

//   // Add activity to tracking
//   const addActivity = async (type, vegetable, description) => {
//     const activity = {
//       id: `activity_${Date.now()}`,
//       type,
//       vegetable,
//       description,
//       timestamp: new Date().toISOString(),
//       user: currentUser
//     };

//     // Update local state
//     setActivities(prev => [activity, ...prev.slice(0, 9)]);
    
//     // Save to localStorage for offline
//     const localActivities = JSON.parse(localStorage.getItem("local_activities") || "[]");
//     localActivities.unshift(activity);
//     localStorage.setItem("local_activities", JSON.stringify(localActivities.slice(0, 50)));

//     // Save to Supabase if online
//     if (isOnline) {
//       try {
//         await supabase
//           .from("vegetable_activities")
//           .insert(activity);
//       } catch (error) {
//         console.error("Error saving activity:", error);
//       }
//     }
//   };

//   // Save to pending sync queue
//   const saveToPending = (action, data) => {
//     const pending = JSON.parse(localStorage.getItem("pending_vegetables") || "[]");
//     const pendingItem = {
//       id: `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
//       action,
//       data,
//       timestamp: new Date().toISOString(),
//       user: currentUser,
//       synced: false
//     };
    
//     pending.push(pendingItem);
//     localStorage.setItem("pending_vegetables", JSON.stringify(pending));
//     setPendingSync(pending);
//   };

//   // Sync pending changes to Supabase
//   const syncPendingChanges = async () => {
//     if (!isOnline) return;
    
//     const pending = JSON.parse(localStorage.getItem("pending_vegetables") || "[]");
//     if (pending.length === 0) return;

//     setLoading(true);
//     try {
//       const successfulSyncs = [];
//       const failedSyncs = [];
      
      
//       for (const item of pending) {
//         if (item.synced) continue;
        
//         try {
//           switch (item.action) {
//             case "add":
//               const { data: addedData, error: addError } = await supabase
//                 .from("vegetables_list")
//                 .insert(item.data)
//                 .select()
//                 .single();
              
//               if (!addError) {
//                 successfulSyncs.push(item.id);
//                 item.synced = true;
//                 // Add activity for successful sync
//                 await addActivity("added", item.data.name, "Synced from offline");
//               } else {
//                 throw addError;
//               }
//               break;
              
//             case "update":
//               const { error: updateError } = await supabase
//                 .from("vegetables_list")
//                 .update(item.data)
//                 .eq("id", item.data.id);
              
//               if (!updateError) {
//                 successfulSyncs.push(item.id);
//                 item.synced = true;
//                 await addActivity("updated", item.data.name, "Synced from offline");
//               } else {
//                 throw updateError;
//               }
//               break;
              
//             case "delete":
//               const { error: deleteError } = await supabase
//                 .from("vegetables_list")
//                 .delete()
//                 .eq("id", item.data.id);
              
//               if (!deleteError) {
//                 successfulSyncs.push(item.id);
//                 item.synced = true;
//                 await addActivity("deleted", item.data.name, "Synced from offline");
//               } else {
//                 throw deleteError;
//               }
//               break;
              
//             case "toggle":
//               const { error: toggleError } = await supabase
//                 .from("vegetables_list")
//                 .update({ is_active: item.data.is_active })
//                 .eq("id", item.data.id);
              
//               if (!toggleError) {
//                 successfulSyncs.push(item.id);
//                 item.synced = true;
//                 await addActivity("updated", item.data.name, "Status synced from offline");
//               } else {
//                 throw toggleError;
//               }
//               break;
//           }
//         } catch (error) {
//           console.error(`Failed to sync item ${item.id}:`, error);
//           failedSyncs.push(item.id);
//         }
//       }
      
//       // Update pending list
//       const updatedPending = pending.filter(item => !item.synced);
//       localStorage.setItem("pending_vegetables", JSON.stringify(updatedPending));
//       setPendingSync(updatedPending);
      
//       // Show sync results
//       if (successfulSyncs.length > 0) {
//         showNotification("success", `Synced ${successfulSyncs.length} item(s) successfully`);
//       }
//       if (failedSyncs.length > 0) {
//         showNotification("error", `Failed to sync ${failedSyncs.length} item(s)`);
//       }
      
//     } catch (error) {
//       console.error("Error syncing pending changes:", error);
//       showNotification("error", "Failed to sync pending changes");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Add new vegetable
//   const handleAddVegetable = async (e) => {
//     e.preventDefault();
    
//     if (!newVegetableName.trim()) {
//       showNotification("error", "Please enter a vegetable name");
//       return;
//     }

//     // Check for duplicates
//     const duplicate = vegetables.find(v => 
//       v.name.toLowerCase() === newVegetableName.trim().toLowerCase()
//     );
    
//     if (duplicate) {
//       showNotification("error", "This vegetable already exists");
//       return;
//     }

//     setLoading(true);
//     try {
//       const newVeggie = {
//         name: newVegetableName.trim(),
//         created_by: currentUser,
//         created_at: new Date().toISOString(),
//         updated_at: new Date().toISOString(),
//         is_active: true,
//         description: "" // Optional description field
//       };

//       if (isOnline) {
//         const { data, error } = await supabase
//           .from("vegetables_list")
//           .insert(newVeggie)
//           .select()
//           .single();

//         if (error) throw error;

//         setVegetables(prev => [data, ...prev]);
//         await addActivity("added", newVeggie.name, "New vegetable added");
//         showNotification("success", "Vegetable added successfully!");
//       } else {
//         // Save to pending
//         saveToPending("add", newVeggie);
        
//         // Add to local state
//         const tempVeggie = {
//           ...newVeggie,
//           id: `pending_${Date.now()}`,
//           isPending: true
//         };
        
//         setVegetables(prev => [tempVeggie, ...prev]);
//         addActivity("added", newVeggie.name, "New vegetable added (offline)");
//         showNotification("success", "Vegetable saved locally! Will sync when online.");
//       }
      
//       // Reset form
//       setNewVegetableName("");
//       setShowAddForm(false);
      
//     } catch (error) {
//       console.error("Error adding vegetable:", error);
//       showNotification("error", "Failed to add vegetable");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Edit existing vegetable
//   const handleEditVegetable = async (e) => {
//     e.preventDefault();
    
//     if (!editingVegetable || !editVegetableName.trim()) {
//       showNotification("error", "Please enter a vegetable name");
//       return;
//     }

//     // Check for duplicates
//     const duplicate = vegetables.find(v => 
//       v.id !== editingVegetable.id &&
//       v.name.toLowerCase() === editVegetableName.trim().toLowerCase()
//     );
    
//     if (duplicate) {
//       showNotification("error", "This vegetable name already exists");
//       return;
//     }

//     setLoading(true);
//     try {
//       const updatedVeggie = {
//         ...editingVegetable,
//         name: editVegetableName.trim(),
//         updated_at: new Date().toISOString()
//       };

//       if (isOnline && !editingVegetable.isPending) {
//         const { error } = await supabase
//           .from("vegetables_list")
//           .update({
//             name: editVegetableName.trim(),
//             updated_at: new Date().toISOString()
//           })
//           .eq("id", editingVegetable.id);

//         if (error) throw error;

//         setVegetables(prev => prev.map(v => 
//           v.id === editingVegetable.id ? updatedVeggie : v
//         ));

//         await addActivity("updated", editVegetableName.trim(), "Vegetable updated");
//         showNotification("success", "Vegetable updated successfully!");
//       } else {
//         if (editingVegetable.isPending) {
//           // Update local pending
//           setVegetables(prev => prev.map(v => 
//             v.id === editingVegetable.id ? updatedVeggie : v
//           ));
//         } else {
//           // Save to pending
//           saveToPending("update", {
//             id: editingVegetable.id,
//             name: editVegetableName.trim(),
//             updated_at: new Date().toISOString()
//           });
          
//           // Update local state
//           setVegetables(prev => prev.map(v => 
//             v.id === editingVegetable.id ? updatedVeggie : v
//           ));
//         }
        
//         addActivity("updated", editVegetableName.trim(), "Vegetable updated (offline)");
//         showNotification("success", "Vegetable updated locally! Will sync when online.");
//       }
      
//       // Reset form
//       setEditingVegetable(null);
//       setEditVegetableName("");
//       setShowEditForm(false);
      
//     } catch (error) {
//       console.error("Error editing vegetable:", error);
//       showNotification("error", "Failed to update vegetable");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Toggle vegetable status (active/inactive)
//   const handleToggleStatus = async (vegetable) => {
//     setLoading(true);
//     try {
//       const newStatus = !vegetable.is_active;
      
//       if (isOnline && !vegetable.isPending) {
//         const { error } = await supabase
//           .from("vegetables_list")
//           .update({ 
//             is_active: newStatus,
//             updated_at: new Date().toISOString()
//           })
//           .eq("id", vegetable.id);

//         if (error) throw error;

//         setVegetables(prev => prev.map(v => 
//           v.id === vegetable.id ? { ...v, is_active: newStatus, updated_at: new Date().toISOString() } : v
//         ));

//         await addActivity("updated", vegetable.name, 
//           `Vegetable ${newStatus ? "activated" : "deactivated"}`
//         );
//         showNotification("success", `Vegetable ${newStatus ? "activated" : "deactivated"} successfully!`);
//       } else {
//         if (vegetable.isPending) {
//           // Update local pending
//           setVegetables(prev => prev.map(v => 
//             v.id === vegetable.id ? { ...v, is_active: newStatus, updated_at: new Date().toISOString() } : v
//           ));
//         } else {
//           // Save to pending
//           saveToPending("toggle", { 
//             id: vegetable.id,
//             is_active: newStatus,
//             updated_at: new Date().toISOString()
//           });
          
//           // Update local state
//           setVegetables(prev => prev.map(v => 
//             v.id === vegetable.id ? { ...v, is_active: newStatus, updated_at: new Date().toISOString() } : v
//           ));
//         }
        
//         addActivity("updated", vegetable.name, 
//           `Vegetable ${newStatus ? "activated" : "deactivated"} (offline)`
//         );
//         showNotification("success", `Vegetable ${newStatus ? "activated" : "deactivated"} locally! Will sync when online.`);
//       }
      
//     } catch (error) {
//       console.error("Error toggling vegetable status:", error);
//       showNotification("error", "Failed to update vegetable status");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Delete vegetable (soft delete)
//   const handleDeleteVegetable = async (vegetable) => {
//     setItemToDelete(vegetable);
//     setShowConfirmDelete(true);
//   };

//   // Confirm and execute deletion
//   const confirmDelete = async () => {
//     if (!itemToDelete) return;
    
//     setLoading(true);
//     try {
//       if (isOnline && !itemToDelete.isPending) {
//         const { error } = await supabase
//           .from("vegetables_list")
//           .update({ 
//             is_active: false,
//             updated_at: new Date().toISOString()
//           })
//           .eq("id", itemToDelete.id);

//         if (error) throw error;

//         setVegetables(prev => prev.map(v => 
//           v.id === itemToDelete.id ? { ...v, is_active: false, updated_at: new Date().toISOString() } : v
//         ));

//         await addActivity("deleted", itemToDelete.name, "Vegetable deactivated");
//         showNotification("success", "Vegetable deactivated successfully!");
//       } else {
//         if (itemToDelete.isPending) {
//           // Remove from local pending
//           setVegetables(prev => prev.filter(v => v.id !== itemToDelete.id));
//           // Also remove from pending sync
//           const pending = JSON.parse(localStorage.getItem("pending_vegetables") || "[]");
//           const updatedPending = pending.filter(p => p.data.id !== itemToDelete.id);
//           localStorage.setItem("pending_vegetables", JSON.stringify(updatedPending));
//           setPendingSync(updatedPending);
//         } else {
//           // Save to pending
//           saveToPending("delete", { id: itemToDelete.id });
          
//           // Update local state
//           setVegetables(prev => prev.map(v => 
//             v.id === itemToDelete.id ? { ...v, is_active: false, updated_at: new Date().toISOString() } : v
//           ));
//         }
        
//         addActivity("deleted", itemToDelete.name, "Vegetable deactivated (offline)");
//         showNotification("success", "Vegetable deactivated locally! Will sync when online.");
//       }
      
//     } catch (error) {
//       console.error("Error deleting vegetable:", error);
//       showNotification("error", "Failed to delete vegetable");
//     } finally {
//       setLoading(false);
//       setShowConfirmDelete(false);
//       setItemToDelete(null);
//     }
//   };

//   // Permanent delete (for inactive items)
//   const handlePermanentDelete = async (vegetable) => {
//     if (!window.confirm(`Permanently delete "${vegetable.name}"? This cannot be undone!`)) return;
    
//     setLoading(true);
//     try {
//       if (isOnline && !vegetable.isPending) {
//         const { error } = await supabase
//           .from("vegetables_list")
//           .delete()
//           .eq("id", vegetable.id);

//         if (error) throw error;

//         setVegetables(prev => prev.filter(v => v.id !== vegetable.id));
//         await addActivity("deleted", vegetable.name, "Vegetable permanently deleted");
//         showNotification("success", "Vegetable permanently deleted!");
//       } else {
//         if (vegetable.isPending) {
//           setVegetables(prev => prev.filter(v => v.id !== vegetable.id));
//           const pending = JSON.parse(localStorage.getItem("pending_vegetables") || "[]");
//           const updatedPending = pending.filter(p => p.data.id !== vegetable.id);
//           localStorage.setItem("pending_vegetables", JSON.stringify(updatedPending));
//           setPendingSync(updatedPending);
//         } else {
//           saveToPending("delete", { id: vegetable.id });
//           setVegetables(prev => prev.filter(v => v.id !== vegetable.id));
//         }
//         addActivity("deleted", vegetable.name, "Vegetable permanently deleted (offline)");
//         showNotification("success", "Vegetable deleted locally! Will sync when online.");
//       }
//     } catch (error) {
//       console.error("Error permanently deleting vegetable:", error);
//       showNotification("error", "Failed to delete vegetable");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Notification helper
//   const showNotification = (type, message) => {
//     if (type === "success") {
//       setSuccessMessage(message);
//       setShowSuccess(true);
//       setTimeout(() => setShowSuccess(false), 3000);
//     } else {
//       setErrorMessage(message);
//       setShowError(true);
//       setTimeout(() => setShowError(false), 3000);
//     }
//   };

//   // Filter vegetables based on search and filter
//   const filteredVegetables = vegetables.filter(vegetable => {
//     const matchesSearch = searchTerm.trim() === "" || 
//       vegetable.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
//       (vegetable.description && vegetable.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
//     const matchesFilter = filterActive === "all" || 
//       (filterActive === "active" && vegetable.is_active) ||
//       (filterActive === "inactive" && !vegetable.is_active);
    
//     return matchesSearch && matchesFilter;
//   });

//   // Pagination calculations
//   const totalPages = Math.ceil(totalItems / itemsPerPage);
//   const handlePageChange = (page) => {
//     if (page < 1 || page > totalPages) return;
//     setCurrentPage(page);
//     window.scrollTo({ top: 0, behavior: "smooth" });
//   };

//   // Format date
//   const formatDate = (dateString) => {
//     if (!dateString) return "N/A";
//     const date = new Date(dateString);
//     return date.toLocaleDateString("en-US", {
//       year: "numeric",
//       month: "short",
//       day: "numeric",
//       hour: "2-digit",
//       minute: "2-digit"
//     });
//   };

//   // Format time ago
//   const formatTimeAgo = (dateString) => {
//     if (!dateString) return "Unknown";
//     const date = new Date(dateString);
//     const now = new Date();
//     const diffMs = now - date;
//     const diffMins = Math.floor(diffMs / 60000);
//     const diffHours = Math.floor(diffMs / 3600000);
//     const diffDays = Math.floor(diffMs / 86400000);

//     if (diffMins < 1) return "Just now";
//     if (diffMins < 60) return `${diffMins}m ago`;
//     if (diffHours < 24) return `${diffHours}h ago`;
//     if (diffDays < 7) return `${diffDays}d ago`;
//     return date.toLocaleDateString();
//   };

//   // Activity item component
//   const ActivityItem = ({ activity }) => {
//     const getActivityIcon = (type) => {
//       switch (type) {
//         case "added": return { icon: FaPlus, color: "text-green-600", bg: "bg-green-100" };
//         case "updated": return { icon: FaEdit, color: "text-blue-600", bg: "bg-blue-100" };
//         case "deleted": return { icon: FaTrash, color: "text-red-600", bg: "bg-red-100" };
//         default: return { icon: FaHistory, color: "text-gray-600", bg: "bg-gray-100" };
//       }
//     };
    
//     const { icon: Icon, color, bg } = getActivityIcon(activity.type);
    
//     return (
//       <div className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors duration-200">
//         <div className={`flex-shrink-0 w-10 h-10 rounded-full ${bg} flex items-center justify-center`}>
//           <Icon className={`w-5 h-5 ${color}`} />
//         </div>
//         <div className="flex-1 min-w-0">
//           <div className="flex justify-between items-start">
//             <p className="text-sm font-medium text-gray-900">{activity.vegetable}</p>
//             <span className="text-xs text-gray-500">{formatTimeAgo(activity.timestamp)}</span>
//           </div>
//           <p className="text-sm text-gray-600">{activity.description}</p>
//           <div className="flex items-center mt-1 space-x-2">
//             <FaUser className="w-3 h-3 text-gray-400" />
//             <span className="text-xs text-gray-500">{activity.user}</span>
//           </div>
//         </div>
//       </div>
//     );
//   };

//   // Vegetable card component
//   const VegetableCard = ({ vegetable }) => (
//     <div className={`bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow duration-200 ${
//       vegetable.isPending ? "border-yellow-300 bg-yellow-50" : "border-gray-200"
//     }`}>
//       <div className="flex justify-between items-start mb-4">
//         <div className="flex-1">
//           <div className="flex items-center gap-2 mb-1">
//             <h3 className="text-lg font-semibold text-gray-800">{vegetable.name}</h3>
//             {vegetable.isPending && (
//               <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
//                 <FaCloudOff className="w-3 h-3 mr-1" />
//                 Pending
//               </span>
//             )}
//           </div>
//           <div className="flex items-center mt-1 space-x-2">
//             <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
//               vegetable.is_active 
//                 ? "bg-green-100 text-green-800" 
//                 : "bg-red-100 text-red-800"
//             }`}>
//               {vegetable.is_active ? (
//                 <>
//                   <FaCheckCircle className="w-3 h-3 mr-1" />
//                   Active
//                 </>
//               ) : (
//                 <>
//                   <FaTimesCircle className="w-3 h-3 mr-1" />
//                   Inactive
//                 </>
//               )}
//             </div>
//             <span className="text-xs text-gray-500">
//               Updated: {formatDate(vegetable.updated_at)}
//             </span>
//           </div>
//         </div>
//       </div>

//       {vegetable.description && (
//         <p className="text-sm text-gray-600 mb-4">{vegetable.description}</p>
//       )}

//       <div className="space-y-2 mb-4">
//         <div className="flex items-center text-sm text-gray-600">
//           <FaUser className="w-4 h-4 mr-2 text-gray-400" />
//           <span>Created by {vegetable.created_by}</span>
//         </div>
//         <div className="flex items-center text-sm text-gray-600">
//           <FaCalendarAlt className="w-4 h-4 mr-2 text-gray-400" />
//           <span>Created: {formatDate(vegetable.created_at)}</span>
//         </div>
//       </div>

//       <div className="flex justify-between pt-4 border-t border-gray-100">
//         <button
//           onClick={() => handleToggleStatus(vegetable)}
//           className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
//             vegetable.is_active
//               ? "bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
//               : "bg-green-50 text-green-700 hover:bg-green-100"
//           }`}
//           disabled={loading}
//         >
//           {vegetable.is_active ? "Deactivate" : "Activate"}
//         </button>
        
//         <div className="flex space-x-2">
//           <button
//             onClick={() => {
//               setEditingVegetable(vegetable);
//               setEditVegetableName(vegetable.name);
//               setShowEditForm(true);
//             }}
//             className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors duration-200 flex items-center"
//             disabled={loading}
//           >
//             <FaEdit className="w-4 h-4 mr-2" />
//             Edit
//           </button>
          
//           {!vegetable.is_active && (
//             <button
//               onClick={() => handleDeleteVegetable(vegetable)}
//               className="px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors duration-200 flex items-center"
//               disabled={loading}
//             >
//               <FaTrash className="w-4 h-4 mr-2" />
//               Delete
//             </button>
//           )}
//         </div>
//       </div>
//     </div>
//   );

//   // Pagination component
//   const Pagination = () => (
//     <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 sm:px-6">
//       <div className="flex flex-1 justify-between sm:hidden">
//         <button
//           onClick={() => handlePageChange(currentPage - 1)}
//           disabled={currentPage === 1 || loading}
//           className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
//         >
//           Previous
//         </button>
//         <button
//           onClick={() => handlePageChange(currentPage + 1)}
//           disabled={currentPage === totalPages || loading}
//           className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
//         >
//           Next
//         </button>
//       </div>
//       <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
//         <div>
//           <p className="text-sm text-gray-700">
//             Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{" "}
//             <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of{" "}
//             <span className="font-medium">{totalItems}</span> results
//           </p>
//         </div>
//         <div>
//           <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
//             <button
//               onClick={() => handlePageChange(currentPage - 1)}
//               disabled={currentPage === 1 || loading}
//               className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
//             >
//               <span className="sr-only">Previous</span>
//               <FaChevronLeft className="h-5 w-5" aria-hidden="true" />
//             </button>
            
//             {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
//               let pageNum;
//               if (totalPages <= 5) {
//                 pageNum = i + 1;
//               } else if (currentPage <= 3) {
//                 pageNum = i + 1;
//               } else if (currentPage >= totalPages - 2) {
//                 pageNum = totalPages - 4 + i;
//               } else {
//                 pageNum = currentPage - 2 + i;
//               }
              
//               return (
//                 <button
//                   key={pageNum}
//                   onClick={() => handlePageChange(pageNum)}
//                   disabled={loading}
//                   className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
//                     currentPage === pageNum
//                       ? "z-10 bg-green-600 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
//                       : "text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
//                   }`}
//                 >
//                   {pageNum}
//                 </button>
//               );
//             })}
            
//             <button
//               onClick={() => handlePageChange(currentPage + 1)}
//               disabled={currentPage === totalPages || loading}
//               className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
//             >
//               <span className="sr-only">Next</span>
//               <FaChevronRight className="h-5 w-5" aria-hidden="true" />
//             </button>
//           </nav>
//         </div>
//       </div>
//     </div>
//   );

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-100 to-teal-50 p-6">
//       <div className="max-w-7xl mx-auto">
//         {/* Connection Status Banner */}
//         {!isOnline && (
//           <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg shadow-sm animate-pulse">
//             <div className="flex items-center">
//               <FaCloudOff className="w-5 h-5 text-yellow-600 mr-3" />
//               <div className="flex-1">
//                 <p className="text-sm font-medium text-yellow-800">You're offline</p>
//                 <p className="text-sm text-yellow-700">Changes will be saved locally and synced when you're back online.</p>
//               </div>
//               {pendingSync.length > 0 && (
//                 <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
//                   {pendingSync.length} pending
//                 </span>
//               )}
//             </div>
//           </div>
//         )}

//         {/* Pending Sync Banner */}
//         {pendingSync.length > 0 && isOnline && (
//           <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg shadow-sm">
//             <div className="flex items-center justify-between">
//               <div className="flex items-center">
//                 <FaCloudUploadAlt className="w-5 h-5 text-blue-600 mr-3" />
//                 <div>
//                   <p className="text-sm font-medium text-blue-800">Pending changes to sync</p>
//                   <p className="text-sm text-blue-700">{pendingSync.length} changes waiting to be synced</p>
//                 </div>
//               </div>
//               <button
//                 onClick={syncPendingChanges}
//                 className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors duration-200 flex items-center"
//                 disabled={loading}
//               >
//                 {loading ? (
//                   <FaSpinner className="w-4 h-4 mr-2 animate-spin" />
//                 ) : (
//                   <FaCloudUploadAlt className="w-4 h-4 mr-2" />
//                 )}
//                 Sync Now
//               </button>
//             </div>
//           </div>
//         )}

//         {/* Header */}
//         <div className="flex justify-between items-center mb-8">
//           <div>
//             <div className="flex items-center gap-3 mb-2">
//               <h1 className="text-3xl font-bold text-gray-900 flex items-center">
//                 <FaLeaf className="mr-3 text-green-600" />
//                 Vegetable Management
//               </h1>
//               <div className="flex items-center gap-2">
//                 <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
//                   isOnline 
//                     ? "bg-green-100 text-green-800" 
//                     : "bg-yellow-100 text-yellow-800"
//                 }`}>
//                   {isOnline ? (
//                     <>
//                       <FaCloud className="w-3 h-3 mr-1" />
//                       Online
//                     </>
//                   ) : (
//                     <>
//                       <FaCloudOff className="w-3 h-3 mr-1" />
//                       Offline
//                     </>
//                   )}
//                 </div>
//                 {pendingSync.length > 0 && (
//                   <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
//                     <FaDatabase className="w-3 h-3 mr-1" />
//                     {pendingSync.length} pending
//                   </div>
//                 )}
//               </div>
//             </div>
//             <p className="text-gray-600">Manage your vegetable database with CRUD operations</p>
//           </div>
          
//           <div className="flex items-center space-x-4">
//             <div className="text-right">
//               <p className="text-sm font-medium text-gray-900">{currentUser}</p>
//               <p className="text-xs text-gray-500">Vegetable Manager</p>
//             </div>
//             <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
//               <FaUser className="w-5 h-5 text-green-600" />
//             </div>
//           </div>
//         </div>

//         {/* Stats Cards */}
//         <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
//           <div className="bg-white rounded-xl shadow-sm p-6">
//             <div className="flex items-center justify-between">
//               <div>
//                 <p className="text-sm text-gray-500">Total Vegetables</p>
//                 <p className="text-3xl font-bold text-gray-900 mt-2">{totalItems}</p>
//               </div>
//               <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
//                 <FaLeaf className="w-6 h-6 text-blue-600" />
//               </div>
//             </div>
//           </div>
          
//           <div className="bg-white rounded-xl shadow-sm p-6">
//             <div className="flex items-center justify-between">
//               <div>
//                 <p className="text-sm text-gray-500">Active</p>
//                 <p className="text-3xl font-bold text-gray-900 mt-2">
//                   {vegetables.filter(v => v.is_active).length}
//                 </p>
//               </div>
//               <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
//                 <FaCheckCircle className="w-6 h-6 text-green-600" />
//               </div>
//             </div>
//           </div>
          
//           <div className="bg-white rounded-xl shadow-sm p-6">
//             <div className="flex items-center justify-between">
//               <div>
//                 <p className="text-sm text-gray-500">Inactive</p>
//                 <p className="text-3xl font-bold text-gray-900 mt-2">
//                   {vegetables.filter(v => !v.is_active).length}
//                 </p>
//               </div>
//               <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
//                 <FaTimesCircle className="w-6 h-6 text-red-600" />
//               </div>
//             </div>
//           </div>
          
//           <div className="bg-white rounded-xl shadow-sm p-6">
//             <div className="flex items-center justify-between">
//               <div>
//                 <p className="text-sm text-gray-500">Pending Sync</p>
//                 <p className="text-3xl font-bold text-gray-900 mt-2">
//                   {pendingSync.length}
//                 </p>
//               </div>
//               <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
//                 <FaCloudUploadAlt className="w-6 h-6 text-yellow-600" />
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* Main Content */}
//         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
//           {/* Left Column - Management */}
//           <div className="lg:col-span-2 space-y-8">
//             {/* Search and Filter Card */}
//             <div className="bg-white rounded-xl shadow-sm p-6">
//               <div className="mb-6">
//                 <div className="relative">
//                   <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
//                   <input
//                     type="text"
//                     placeholder="Search vegetables..."
//                     className="w-full pl-12 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition duration-200"
//                     value={searchTerm}
//                     onChange={(e) => setSearchTerm(e.target.value)}
//                   />
//                   {searchTerm && (
//                     <button
//                       onClick={() => setSearchTerm("")}
//                       className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
//                     >
//                       <FaTimes className="w-5 h-5" />
//                     </button>
//                   )}
//                 </div>
//               </div>

//               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-2">
//                     Filter by Status
//                   </label>
//                   <div className="flex flex-wrap gap-2">
//                     {["all", "active", "inactive"].map((filter) => (
//                       <button
//                         key={filter}
//                         onClick={() => setFilterActive(filter)}
//                         className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
//                           filterActive === filter
//                             ? "bg-green-600 text-white"
//                             : "bg-gray-100 text-gray-700 hover:bg-gray-200"
//                         }`}
//                       >
//                         {filter.charAt(0).toUpperCase() + filter.slice(1)}
//                       </button>
//                     ))}
//                   </div>
//                 </div>
                
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-2">
//                     Sort by
//                   </label>
//                   <div className="flex gap-2">
//                     <select
//                       value={sortBy}
//                       onChange={(e) => setSortBy(e.target.value)}
//                       className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
//                     >
//                       <option value="name">Name</option>
//                       <option value="created_at">Created Date</option>
//                       <option value="updated_at">Updated Date</option>
//                     </select>
//                     <button
//                       onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
//                       className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
//                     >
//                       {sortOrder === "asc" ? "↑" : "↓"}
//                     </button>
//                   </div>
//                 </div>
//               </div>

//               <div className="flex justify-between items-center">
//                 <p className="text-sm text-gray-600">
//                   Showing {filteredVegetables.length} vegetables
//                 </p>
//                 <div className="flex gap-2">
//                   {pendingSync.length > 0 && isOnline && (
//                     <button
//                       onClick={syncPendingChanges}
//                       className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors duration-200 flex items-center"
//                       disabled={loading}
//                     >
//                       {loading ? (
//                         <FaSpinner className="w-4 h-4 mr-2 animate-spin" />
//                       ) : (
//                         <FaCloudUploadAlt className="w-4 h-4 mr-2" />
//                       )}
//                       Sync
//                     </button>
//                   )}
//                   <button
//                     onClick={loadVegetables}
//                     className="px-4 py-2 bg-gray-50 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors duration-200 flex items-center"
//                     disabled={loading}
//                   >
//                     {loading ? (
//                       <>
//                         <FaSpinner className="w-4 h-4 mr-2 animate-spin" />
//                         Refreshing...
//                       </>
//                     ) : (
//                       <>
//                         <FaSync className="w-4 h-4 mr-2" />
//                         Refresh
//                       </>
//                     )}
//                   </button>
//                 </div>
//               </div>
//             </div>

//             {/* Add Button */}
//             <div className="bg-white rounded-xl shadow-sm p-6">
//               <button
//                 onClick={() => setShowAddForm(true)}
//                 className="w-full py-4 bg-green-600 text-white rounded-lg text-lg font-semibold hover:bg-green-700 transition-colors duration-200 flex items-center justify-center"
//               >
//                 <FaPlus className="w-6 h-6 mr-3" />
//                 Add New Vegetable
//               </button>
//             </div>

//             {/* Vegetables List */}
//             <div className="bg-white rounded-xl shadow-sm overflow-hidden">
//               <div className="p-6 border-b border-gray-200">
//                 <div className="flex justify-between items-center">
//                   <h2 className="text-xl font-bold text-gray-900">
//                     Vegetables ({filteredVegetables.length})
//                   </h2>
//                   <div className="flex items-center gap-4">
//                     <span className="text-sm text-gray-500">
//                       {filterActive === "all" ? "All vegetables" : 
//                        filterActive === "active" ? "Active only" : "Inactive only"}
//                     </span>
//                     <div className="flex items-center gap-2">
//                       <span className="text-sm text-gray-500">Show:</span>
//                       <select
//                         value={itemsPerPage}
//                         onChange={(e) => setItemsPerPage(Number(e.target.value))}
//                         className="text-sm border border-gray-300 rounded px-2 py-1"
//                       >
//                         <option value={5}>5</option>
//                         <option value={10}>10</option>
//                         <option value={25}>25</option>
//                         <option value={50}>50</option>
//                       </select>
//                     </div>
//                   </div>
//                 </div>
//               </div>

//               {loading ? (
//                 <div className="flex flex-col items-center justify-center py-12">
//                   <FaSpinner className="w-12 h-12 text-green-600 animate-spin mb-4" />
//                   <p className="text-gray-600">Loading vegetables...</p>
//                 </div>
//               ) : filteredVegetables.length === 0 ? (
//                 <div className="text-center py-12">
//                   <FaLeaf className="w-16 h-16 text-gray-300 mx-auto mb-4" />
//                   <h3 className="text-lg font-medium text-gray-900 mb-2">
//                     {searchTerm ? "No vegetables found" : "No vegetables yet"}
//                   </h3>
//                   <p className="text-gray-600 mb-4">
//                     {searchTerm 
//                       ? "Try a different search term" 
//                       : "Add your first vegetable to get started"}
//                   </p>
//                   <button
//                     onClick={() => setShowAddForm(true)}
//                     className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
//                   >
//                     Add Vegetable
//                   </button>
//                 </div>
//               ) : (
//                 <>
//                   <div className="p-6">
//                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                       {filteredVegetables.map((vegetable) => (
//                         <VegetableCard key={vegetable.id} vegetable={vegetable} />
//                       ))}
//                     </div>
//                   </div>
//                   {totalPages > 1 && <Pagination />}
//                 </>
//               )}
//             </div>
//           </div>

//           {/* Right Column - Activities */}
//           <div className="space-y-8">
//             {/* Activities Card */}
//             <div className="bg-white rounded-xl shadow-sm p-6">
//               <div className="flex justify-between items-center mb-6">
//                 <h2 className="text-xl font-bold text-gray-900 flex items-center">
//                   <FaHistory className="w-6 h-6 mr-3 text-green-600" />
//                   Recent Activities
//                 </h2>
//                 <button
//                   onClick={() => setShowActivities(!showActivities)}
//                   className="text-sm text-green-600 hover:text-green-700 font-medium"
//                 >
//                   {showActivities ? "Hide" : "Show All"}
//                 </button>
//               </div>

//               {isLoadingActivities ? (
//                 <div className="flex flex-col items-center justify-center py-8">
//                   <FaSpinner className="w-8 h-8 text-green-600 animate-spin mb-2" />
//                   <p className="text-sm text-gray-600">Loading activities...</p>
//                 </div>
//               ) : activities.length === 0 ? (
//                 <div className="text-center py-8">
//                   <FaHistory className="w-12 h-12 text-gray-300 mx-auto mb-4" />
//                   <p className="text-gray-600">No activities yet</p>
//                 </div>
//               ) : (
//                 <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
//                   {activities.slice(0, showActivities ? activities.length : 5).map((activity) => (
//                     <ActivityItem key={activity.id} activity={activity} />
//                   ))}
//                 </div>
//               )}
//             </div>

//             {/* Quick Actions */}
//             <div className="bg-white rounded-xl shadow-sm p-6">
//               <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
//               <div className="space-y-3">
//                 <button
//                   onClick={loadVegetables}
//                   className="w-full px-4 py-3 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors duration-200 flex items-center justify-between"
//                   disabled={loading}
//                 >
//                   <span>Refresh All Data</span>
//                   <FaSync className="w-4 h-4" />
//                 </button>
//                 <button
//                   onClick={() => {
//                     setFilterActive("active");
//                     setSearchTerm("");
//                   }}
//                   className="w-full px-4 py-3 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors duration-200 flex items-center justify-between"
//                 >
//                   <span>View Active Only</span>
//                   <FaCheckCircle className="w-4 h-4" />
//                 </button>
//                 <button
//                   onClick={() => {
//                     setFilterActive("inactive");
//                     setSearchTerm("");
//                   }}
//                   className="w-full px-4 py-3 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors duration-200 flex items-center justify-between"
//                 >
//                   <span>View Inactive Only</span>
//                   <FaTimesCircle className="w-4 h-4" />
//                 </button>
//                 {pendingSync.length > 0 && isOnline && (
//                   <button
//                     onClick={syncPendingChanges}
//                     className="w-full px-4 py-3 bg-yellow-50 text-yellow-700 rounded-lg text-sm font-medium hover:bg-yellow-100 transition-colors duration-200 flex items-center justify-between"
//                     disabled={loading}
//                   >
//                     <span>Sync Pending Changes</span>
//                     <FaCloudUploadAlt className="w-4 h-4" />
//                   </button>
//                 )}
//               </div>
//             </div>

//             {/* System Info */}
//             <div className="bg-white rounded-xl shadow-sm p-6">
//               <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
//                 <FaInfoCircle className="w-5 h-5 mr-2 text-green-600" />
//                 System Info
//               </h3>
//               <div className="space-y-3 text-sm">
//                 <div className="flex justify-between">
//                   <span className="text-gray-600">Connection:</span>
//                   <span className={`font-medium ${
//                     isOnline ? "text-green-600" : "text-yellow-600"
//                   }`}>
//                     {isOnline ? "Online" : "Offline"}
//                   </span>
//                 </div>
//                 <div className="flex justify-between">
//                   <span className="text-gray-600">Pending Sync:</span>
//                   <span className="font-medium">{pendingSync.length} items</span>
//                 </div>
//                 <div className="flex justify-between">
//                   <span className="text-gray-600">Last Updated:</span>
//                   <span className="font-medium">{formatTimeAgo(vegetables[0]?.updated_at)}</span>
//                 </div>
//                 <div className="flex justify-between">
//                   <span className="text-gray-600">Database:</span>
//                   <span className="font-medium">Supabase</span>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* Add Vegetable Modal */}
//       {showAddForm && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
//           <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
//             <div className="p-6">
//               <div className="flex justify-between items-center mb-6">
//                 <h3 className="text-xl font-bold text-gray-900">Add New Vegetable</h3>
//                 <button
//                   onClick={() => setShowAddForm(false)}
//                   className="text-gray-400 hover:text-gray-600"
//                 >
//                   <FaTimesCircle className="w-6 h-6" />
//                 </button>
//               </div>

//               <form onSubmit={handleAddVegetable}>
//                 <div className="mb-6">
//                   <label className="block text-sm font-medium text-gray-700 mb-2">
//                     Vegetable Name *
//                   </label>
//                   <input
//                     type="text"
//                     className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition duration-200"
//                     placeholder="Enter vegetable name"
//                     value={newVegetableName}
//                     onChange={(e) => setNewVegetableName(e.target.value)}
//                     required
//                     autoFocus
//                   />
//                 </div>

//                 {!isOnline && (
//                   <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
//                     <div className="flex items-center">
//                       <FaExclamationTriangle className="w-5 h-5 text-yellow-600 mr-3" />
//                       <p className="text-sm text-yellow-800">
//                         You're currently offline. This vegetable will be saved locally and synced when you're back online.
//                       </p>
//                     </div>
//                   </div>
//                 )}

//                 <div className="flex justify-end space-x-3">
//                   <button
//                     type="button"
//                     onClick={() => setShowAddForm(false)}
//                     className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
//                   >
//                     Cancel
//                   </button>
//                   <button
//                     type="submit"
//                     className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
//                     disabled={loading}
//                   >
//                     {loading ? (
//                       <>
//                         <FaSpinner className="w-4 h-4 mr-2 animate-spin" />
//                         Adding...
//                       </>
//                     ) : (
//                       <>
//                         {isOnline ? (
//                           <>
//                             <FaSave className="w-4 h-4 mr-2" />
//                             Add Vegetable
//                           </>
//                         ) : (
//                           <>
//                             <FaCloudOff className="w-4 h-4 mr-2" />
//                             Save Locally
//                           </>
//                         )}
//                       </>
//                     )}
//                   </button>
//                 </div>
//               </form>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Edit Vegetable Modal */}
//       {showEditForm && editingVegetable && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
//           <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
//             <div className="p-6">
//               <div className="flex justify-between items-center mb-6">
//                 <h3 className="text-xl font-bold text-gray-900">Edit Vegetable</h3>
//                 <button
//                   onClick={() => setShowEditForm(false)}
//                   className="text-gray-400 hover:text-gray-600"
//                 >
//                   <FaTimesCircle className="w-6 h-6" />
//                 </button>
//               </div>

//               <form onSubmit={handleEditVegetable}>
//                 <div className="mb-6">
//                   <label className="block text-sm font-medium text-gray-700 mb-2">
//                     Vegetable Name *
//                   </label>
//                   <input
//                     type="text"
//                     className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition duration-200"
//                     placeholder="Enter vegetable name"
//                     value={editVegetableName}
//                     onChange={(e) => setEditVegetableName(e.target.value)}
//                     required
//                     autoFocus
//                   />
//                   <p className="text-xs text-gray-500 mt-2">
//                     ID: {editingVegetable.id}
//                   </p>
//                 </div>

//                 <div className="mb-6 p-4 bg-gray-50 rounded-lg">
//                   <div className="flex justify-between text-sm">
//                     <span className="text-gray-600">Created:</span>
//                     <span className="font-medium">{formatDate(editingVegetable.created_at)}</span>
//                   </div>
//                   <div className="flex justify-between text-sm mt-2">
//                     <span className="text-gray-600">Created by:</span>
//                     <span className="font-medium">{editingVegetable.created_by}</span>
//                   </div>
//                   {editingVegetable.isPending && (
//                     <div className="flex justify-between text-sm mt-2">
//                       <span className="text-gray-600">Status:</span>
//                       <span className="font-medium text-yellow-600">Pending Sync</span>
//                     </div>
//                   )}
//                 </div>

//                 {!isOnline && !editingVegetable.isPending && (
//                   <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
//                     <div className="flex items-center">
//                       <FaExclamationTriangle className="w-5 h-5 text-yellow-600 mr-3" />
//                       <p className="text-sm text-yellow-800">
//                         You're currently offline. Changes will be saved locally and synced when you're back online.
//                       </p>
//                     </div>
//                   </div>
//                 )}

//                 <div className="flex justify-end space-x-3">
//                   <button
//                     type="button"
//                     onClick={() => setShowEditForm(false)}
//                     className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
//                   >
//                     Cancel
//                   </button>
//                   <button
//                     type="submit"
//                     className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
//                     disabled={loading}
//                   >
//                     {loading ? (
//                       <>
//                         <FaSpinner className="w-4 h-4 mr-2 animate-spin" />
//                         Saving...
//                       </>
//                     ) : (
//                       <>
//                         {isOnline && !editingVegetable.isPending ? (
//                           <>
//                             <FaSave className="w-4 h-4 mr-2" />
//                             Save Changes
//                           </>
//                         ) : (
//                           <>
//                             <FaCloudOff className="w-4 h-4 mr-2" />
//                             Save Locally
//                           </>
//                         )}
//                       </>
//                     )}
//                   </button>
//                 </div>
//               </form>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Confirmation Delete Modal */}
//       {showConfirmDelete && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
//           <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
//             <div className="p-6">
//               <div className="flex justify-between items-center mb-6">
//                 <h3 className="text-xl font-bold text-gray-900">Confirm Delete</h3>
//                 <button
//                   onClick={() => setShowConfirmDelete(false)}
//                   className="text-gray-400 hover:text-gray-600"
//                 >
//                   <FaTimesCircle className="w-6 h-6" />
//                 </button>
//               </div>

//               <div className="mb-6">
//                 <p className="text-gray-700">
//                   Are you sure you want to deactivate <span className="font-semibold">{itemToDelete?.name}</span>?
//                 </p>
//                 <p className="text-sm text-gray-500 mt-2">
//                   The vegetable will be marked as inactive and can be restored later.
//                 </p>
//               </div>

//               <div className="flex justify-end space-x-3">
//                 <button
//                   onClick={() => setShowConfirmDelete(false)}
//                   className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
//                 >
//                   Cancel
//                 </button>
//                 <button
//                   onClick={confirmDelete}
//                   className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center"
//                   disabled={loading}
//                 >
//                   {loading ? (
//                     <>
//                       <FaSpinner className="w-4 h-4 mr-2 animate-spin" />
//                       Deleting...
//                     </>
//                   ) : (
//                     <>
//                       <FaTrash className="w-4 h-4 mr-2" />
//                       Deactivate
//                     </>
//                   )}
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Success Message */}
//       {showSuccess && (
//         <div className="fixed top-4 right-4 z-50 animate-fade-in">
//           <div className="bg-green-50 border border-green-200 rounded-lg shadow-lg p-4 max-w-sm">
//             <div className="flex items-start">
//               <FaCheckCircle className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
//               <div>
//                 <h4 className="text-sm font-medium text-green-800">Success!</h4>
//                 <p className="text-sm text-green-700 mt-1">{successMessage}</p>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Error Message */}
//       {showError && (
//         <div className="fixed top-4 right-4 z-50 animate-fade-in">
//           <div className="bg-red-50 border border-red-200 rounded-lg shadow-lg p-4 max-w-sm">
//             <div className="flex items-start">
//               <FaTimesCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
//               <div>
//                 <h4 className="text-sm font-medium text-red-800">Error!</h4>
//                 <p className="text-sm text-red-700 mt-1">{errorMessage}</p>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Add CSS animations */}
//       <style jsx>{`
//         @keyframes fadeIn {
//           from { opacity: 0; transform: translateY(-10px); }
//           to { opacity: 1; transform: translateY(0); }
//         }
//         .animate-fade-in {
//           animation: fadeIn 0.3s ease-out;
//         }
//         @keyframes spin {
//           from { transform: rotate(0deg); }
//           to { transform: rotate(360deg); }
//         }
//         .animate-spin {
//           animation: spin 1s linear infinite;
//         }
//         @keyframes pulse {
//           0%, 100% { opacity: 1; }
//           50% { opacity: 0.5; }
//         }
//         .animate-pulse {
//           animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
//         }
//       `}</style>
//     </div>
//   );
// };

// export default VegetableManagement;