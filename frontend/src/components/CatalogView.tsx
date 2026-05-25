import React, { useState } from "react";
import { ComponentItem, ComponentCategory } from "../types";
import { supabase, useInventory } from "../context/InventoryContext";
import { iconForCategory, normalizeIcon } from "../services/quoteAdapter";

export default function CatalogView() {
  const { inventory, refreshInventory } = useInventory();
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form states for adding/editing
  const [formId, setFormId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formSku, setFormSku] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formCategory, setFormCategory] = useState<ComponentCategory>("CPU");
  const [formStock, setFormStock] = useState("");
  const [formIcon, setFormIcon] = useState("developer_board");

  const categories: string[] = [
    "All",
    "CPU",
    "GPU",
    "Motherboard",
    "RAM",
    "Storage",
    "PSU",
    "Cooling"
  ];

  const handleOpenAddModal = () => {
    // Reset form
    setFormId(null);
    setFormName("");
    setFormSku("");
    setFormPrice("");
    setFormCategory("CPU");
    setFormStock("");
    setFormIcon("developer_board");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: any) => {
    setFormId(item.id);
    setFormName(item.part_name || item.name || "");
    setFormSku(item.sku || "");
    setFormPrice((item.price || 0).toString());
    setFormCategory(item.category || "CPU");
    setFormStock((item.stock_level ?? item.stock ?? 0).toString());
    // In db, if there is no icon we can provide a default
    // We'll keep the UI state minimal here, maybe ignore icon if it's not in db
    setFormIcon(item.icon || 'developer_board');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSku.trim() || formPrice === "") {
      alert("Please fill out all required fields (Name, SKU, Price).");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        part_name: formName.trim(),
        sku: formSku.trim(),
        price: parseFloat(formPrice) || 0,
        category: formCategory,
        stock_level: parseInt(formStock) || 0,
        icon: formIcon || iconForCategory(formCategory),
      };

      if (formId) {
        // Edit
        const { error } = await supabase
          .from("catalog")
          .update(payload)
          .eq("id", formId);
        if (!error) {
          await refreshInventory();
        } else {
          console.error("Error updating item", error);
          alert(`Error updating item: ${error.message}`);
          return;
        }
      } else {
        // Add
        const { error } = await supabase
          .from("catalog")
          .insert([payload]);
        if (!error) {
          await refreshInventory();
        } else {
          console.error("Error adding item", error);
          alert(`Error adding item: ${error.message}`);
          return;
        }
      }

      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (confirm("Are you sure you want to delete this part?")) {
      const { error } = await supabase
        .from("catalog")
        .delete()
        .eq("id", id);
      if (!error) {
        await refreshInventory();
      } else {
        console.error("Error deleting item", error);
      }
    }
  };

  const handleFormCategoryChange = (catName: string) => {
    setFormCategory(catName as ComponentCategory);
    setFormIcon(iconForCategory(catName));
  };

  // Filter products list
  const filteredItems = inventory.filter((item) => {
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    const matchesSearch = (item.part_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.sku || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-display font-bold text-xl text-[#141514] tracking-tight">
            Catalog
          </h2>
          <p className="text-xs text-[#585956]">
            Manage parts, prices, and stock levels.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="px-4 py-2.5 rounded-lg bg-[#0d6e00] hover:bg-[#0b5c00] text-white font-sans text-xs font-semibold shadow-sm hover:shadow transition-all flex items-center gap-2 group shrink-0"
        >
          <span className="material-symbols-outlined text-sm font-bold transition-transform group-hover:scale-110">add_circle</span>
          <span>Add Part</span>
        </button>
      </div>

      {/* Toolbar filter */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 border-b border-[#dadad7] pb-4">
        {/* Category filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? "bg-[#dadad7] text-[#141514] shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]"
                  : "text-[#585956] hover:bg-[#e6e5df] hover:text-[#141514]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80 shadow-sm rounded-lg overflow-hidden">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="material-symbols-outlined text-[#878884] text-sm font-semibold">search</span>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search parts or SKUs..."
            className="w-full pl-9 pr-4 py-2 bg-white rounded-lg border border-[#dadad7] focus:border-[#0d6e00] text-xs font-semibold text-[#141514] outline-none transition-all placeholder-[#878884]"
          />
        </div>
      </div>

      {/* Components table view list */}
      <div className="rounded-xl border border-[#dadad7] bg-white overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#fbfbfa] border-b border-[#dadad7] text-[10px] font-bold text-[#585956] uppercase tracking-wider">
              <th className="px-5 py-3 w-12"></th>
              <th className="px-5 py-3">Part</th>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3 text-center">Stock Level</th>
              <th className="px-5 py-3 text-right">Price (RM)</th>
              <th className="px-5 py-3 text-right pr-8 w-28">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#dadad7]">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-xs font-semibold text-[#585956]">
                  No matching parts found.
                </td>
              </tr>
            ) : (
              filteredItems.map((it) => {
                const isOutOfStock = it.stock_level === 0;
                const isLowStock = it.stock_level > 0 && it.stock_level <= 10;
                return (
                  <tr
                    key={it.id}
                    className="hover:bg-[#faf9f6]/50 cursor-default transition-colors group"
                  >
                    <td className="px-5 py-4 text-center shrink-0">
                      <div className="w-8 h-8 rounded bg-[#faf9f6] border border-[#dadad7] flex items-center justify-center text-[#585956] group-hover:bg-[#e6f4ea] group-hover:border-[#bccbb3] group-hover:text-[#0d6e00] transition-colors">
                        <span className="material-symbols-outlined text-base leading-none">
                          {normalizeIcon(it.icon, it.category)}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="font-semibold text-xs text-[#141514]">{it.part_name}</div>
                      <div className="text-[10px] font-mono text-[#878884] mt-0.5">SKU: {it.sku}</div>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="inline-flex px-1.5 py-0.5 bg-[#f5f4ef] text-[#585956] border border-[#dadad7]/60 text-[10px] font-bold rounded uppercase tracking-wider font-mono font-medium">
                        {it.category}
                      </span>
                    </td>

                    <td 
                      className="px-5 py-4 text-center whitespace-nowrap cursor-pointer hover:bg-gray-50/70 transition-colors"
                      onClick={() => handleOpenEditModal(it)}
                      title="Click to edit stock level"
                    >
                      <div className="inline-flex items-center justify-center gap-1 group/stock">
                        {isOutOfStock ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#faeae8] text-[#8a1a1a] border border-[#eba1a1]/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
                            Out of Stock
                          </span>
                        ) : isLowStock ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fffdf0] text-[#856404] border border-[#ffeeba]/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#f39c12] animate-pulse"></span>
                            Low: {it.stock_level} left
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#e2f3df] text-[#137333] border border-[#bcdeb5]/50 font-mono">
                            {it.stock_level} units
                          </span>
                        )}
                        <span className="material-symbols-outlined text-[11px] text-[#b5b6b2]/60 select-none group-hover/stock:text-gray-600 transition-colors leading-none">edit</span>
                      </div>
                    </td>

                    <td 
                      className="px-5 py-4 text-right font-mono text-xs font-bold text-[#141514] whitespace-nowrap cursor-pointer hover:bg-gray-50/70 transition-colors"
                      onClick={() => handleOpenEditModal(it)}
                      title="Click to edit price"
                    >
                      <div className="inline-flex items-center justify-end gap-1 group/price">
                        <span>RM {Number(it.price || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                        <span className="material-symbols-outlined text-[11px] text-[#b5b6b2]/60 select-none group-hover/price:text-gray-600 transition-colors leading-none">edit</span>
                      </div>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap text-right pr-8">
                      <div className="flex items-center justify-end gap-2.5">
                        <button
                          onClick={() => handleOpenEditModal(it)}
                          className="p-1 rounded text-gray-500 hover:text-black hover:bg-gray-100 transition-colors cursor-pointer"
                          title="Edit part"
                        >
                          <span className="material-symbols-outlined text-sm font-semibold">edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteItem(it.id)}
                          className="p-1 rounded text-red-450 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Delete part"
                        >
                          <span className="material-symbols-outlined text-sm font-semibold">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Slide Modal popup for add/edit items */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/35 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md bg-white border border-[#dadad7] rounded-xl shadow-2xl p-6 space-y-4"
          >
            <div className="flex justify-between items-center pb-3 border-b border-[#dadad7]">
              <h3 className="font-display font-bold text-sm text-[#141514]">
                Add or Edit Part
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-6 h-6 rounded hover:bg-[#f5f4ef] flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-sm leading-none text-[#585956]">close</span>
              </button>
            </div>

            <div className="space-y-4 text-xs font-semibold text-[#585956]">
              {/* Product Name */}
              <div className="space-y-1">
                <label className="uppercase tracking-wider">Item Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. AMD Milan Threadripper X"
                  className="w-full p-2.5 bg-[#faf9f6] border border-[#dadad7] focus:border-[#0d6e00] rounded-lg outline-none font-sans text-xs font-semibold text-[#141514]"
                />
              </div>

              {/* SKU & Price */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="uppercase tracking-wider">SKU</label>
                  <input
                    type="text"
                    required
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value.toUpperCase())}
                    placeholder="e.g. AMD-MIL-X"
                    className="w-full p-2.5 bg-[#faf9f6] border border-[#dadad7] focus:border-[#0d6e00] rounded-lg outline-none font-mono text-xs font-semibold text-[#141514]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="uppercase tracking-wider">Price (RM)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="e.g. 5499"
                    className="w-full p-2.5 bg-[#faf9f6] border border-[#dadad7] focus:border-[#0d6e00] rounded-lg outline-none font-mono text-xs font-semibold text-[#141514]"
                  />
                </div>
              </div>

              {/* Category selector */}
              <div className="space-y-1">
                <label className="uppercase tracking-wider">Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => handleFormCategoryChange(e.target.value)}
                  className="w-full p-2.5 bg-[#faf9f6] border border-[#dadad7] focus:border-[#0d6e00] rounded-lg outline-none font-sans text-xs font-semibold text-[#141514] cursor-pointer"
                >
                  <option value="CPU">CPU</option>
                  <option value="GPU">GPU</option>
                  <option value="Motherboard">Motherboard</option>
                  <option value="RAM">RAM</option>
                  <option value="Storage">Storage</option>
                  <option value="PSU">PSU</option>
                  <option value="Cooling">Cooling</option>
                </select>
              </div>

              {/* Stock Input */}
              <div className="space-y-1">
                <label className="uppercase tracking-wider">Stock Quantity</label>
                <input
                  type="number"
                  required
                  value={formStock}
                  onChange={(e) => setFormStock(e.target.value)}
                  placeholder="e.g. 45"
                  className="w-full p-2.5 bg-[#faf9f6] border border-[#dadad7] focus:border-[#0d6e00] rounded-lg outline-none font-mono text-xs font-semibold text-[#141514]"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-[#dadad7] flex justify-end gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-[#dadad7] hover:bg-[#faf9f6] rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-[#0d6e00] hover:bg-[#0b5c00] text-white rounded-md transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[170px]"
              >
                {isSaving ? "Saving..." : "Save Part"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
