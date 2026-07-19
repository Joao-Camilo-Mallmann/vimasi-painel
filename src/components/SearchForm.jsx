import { Search, ChevronDown, Check, X } from "lucide-react";
import { useEffect, useMemo, useState, useRef } from "react";
import CATEGORIES, { FIELD_DEFS } from "../config/categories";
import DatabaseService from "../services/DatabaseService";
import { getTipoBadgeStyle } from "../utils/tipoStyles";

export default function SearchForm({ onSearch }) {
  const [tiposDisponiveis, setTiposDisponiveis] = useState([]);
  const [contagem, setContagem] = useState({});
  const [formData, setFormData] = useState({
    codigo: "",
    tipos: [],
    tolerancia: "0.5",
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    DatabaseService.getTipos().then(setTiposDisponiveis);
    DatabaseService.getContagemPorTipo().then(setContagem);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Campos de busca dinâmicos: sempre exibe os 3 de hoje. E se ZO/ZW selecionado, exibe alturaBase.
  const activeFields = useMemo(() => {
    const fields = ["interno", "externo", "altura"];
    if (formData.tipos.includes("ZO") || formData.tipos.includes("ZW")) {
      fields.push("alturaBase");
    }
    return fields;
  }, [formData.tipos]);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const toggleTipo = (tipo) => {
    setFormData((prev) => {
      const alreadySelected = prev.tipos.includes(tipo);
      const newTipos = alreadySelected
        ? prev.tipos.filter((t) => t !== tipo)
        : [...prev.tipos, tipo];
      return { ...prev, tipos: newTipos };
    });
  };

  const clearTipos = () => {
    setFormData((prev) => ({ ...prev, tipos: [] }));
  };

  const dropdownLabel = useMemo(() => {
    if (formData.tipos.length === 0) return "Todos";
    if (formData.tipos.length === tiposDisponiveis.length) return "Todos";
    if (formData.tipos.length <= 2) {
      return formData.tipos.join(", ");
    }
    return `${formData.tipos.length} selecionados`;
  }, [formData.tipos, tiposDisponiveis]);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Montar params apenas com campos ativos
    const params = {
      tipos: formData.tipos,
      tolerancia: formData.tolerancia,
      codigo: formData.codigo,
    };
    for (const field of activeFields) {
      if (formData[field]) {
        params[field] = formData[field];
      }
    }
    onSearch(params);
  };

  return (
    <div className="glass rounded-2xl p-4 md:p-6 w-full max-w-7xl mx-auto relative z-20 animate-fade-in-up">
      <form onSubmit={handleSubmit} className="w-full">
        {/* Linha Única: Código + Categorias + Campos de Dimensão + Tol + Buscar */}
        <div className="flex flex-col lg:flex-row items-end gap-3 w-full">
          
          {/* CÓDIGO */}
          <div className="flex flex-col gap-2 w-full lg:w-36 xl:w-44 flex-1 min-w-[120px]">
            <label className="text-xs uppercase tracking-widest text-gray-400 font-bold ml-1 truncate">
              Código
            </label>
            <input
              type="text"
              name="codigo"
              value={formData.codigo}
              onChange={handleChange}
              placeholder="Ex: ZO-200"
              className="bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-0 focus:border-accent-gold transition-colors shadow-inner w-full uppercase h-[52px]"
            />
          </div>

          {/* TIPO / CATEGORIA (CUSTOM MULTI-SELECT) */}
          <div className="flex flex-col gap-2 w-full lg:w-48 xl:w-56 flex-1 min-w-[160px] relative" ref={dropdownRef}>
            <label className="text-xs uppercase tracking-widest text-gray-400 font-bold ml-1 truncate">
              Categorias
            </label>
            <div className="relative w-full">
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full bg-black/40 border border-white/20 rounded-xl pl-4 pr-16 py-3 text-white flex items-center cursor-pointer focus:outline-none focus:border-accent-gold transition-colors shadow-inner h-[52px] text-left"
              >
                <span className="truncate text-sm font-medium">
                  {dropdownLabel}
                </span>
              </button>

              {/* Chevron icon positioned absolutely inside relative wrapper */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center">
                <ChevronDown
                  size={16}
                  className={`text-gray-400 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
                />
              </div>

              {/* Clear button positioned absolutely inside relative wrapper */}
              {formData.tipos.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearTipos();
                  }}
                  className="absolute right-9 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 text-gray-400 hover:text-white rounded transition-colors cursor-pointer flex items-center justify-center"
                  title="Limpar categorias"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {dropdownOpen && (
              <div className="absolute top-full left-0 mt-2 bg-zinc-950 border border-white/10 rounded-xl shadow-2xl py-2 max-h-64 overflow-y-auto z-[99] backdrop-blur-md animate-fade-in-up w-64 md:w-72">
                {/* Opção Todos / Limpar */}
                <button
                  type="button"
                  onClick={clearTipos}
                  className="w-full px-4 py-2 hover:bg-white/5 transition-colors flex items-center justify-between text-xs font-semibold tracking-wider uppercase text-gray-400 hover:text-white text-left cursor-pointer"
                >
                  <span>Todos</span>
                  {formData.tipos.length === 0 && (
                    <Check size={16} className="text-accent-gold" />
                  )}
                </button>
                <div className="border-t border-white/5 my-1" />
                
                {tiposDisponiveis.map((tipo) => {
                  const cat = CATEGORIES.find((c) => c.tipo === tipo);
                  const label = cat ? cat.label : tipo;
                  const isChecked = formData.tipos.includes(tipo);
                  const count = contagem[tipo] || 0;
                  const badgeStyle = getTipoBadgeStyle(tipo);

                  return (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => toggleTipo(tipo)}
                      className="w-full px-4 py-2 hover:bg-white/5 transition-colors flex items-center gap-3 text-left text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        readOnly
                        className="w-4 h-4 rounded border border-white/20 bg-black/40 text-accent-gold accent-accent-gold cursor-pointer focus:ring-0 focus:ring-offset-0 transition-all shrink-0"
                      />
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-mono border font-bold shadow-sm shrink-0"
                        style={badgeStyle}
                      >
                        {tipo}
                      </span>
                      <span className="text-gray-300 flex-1 truncate">{label}</span>
                      <span className="text-gray-500 font-mono text-xs">({count})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* CAMPOS DINÂMICOS DE DIMENSÃO */}
          {activeFields.map((fieldKey) => {
            const def = FIELD_DEFS[fieldKey];
            if (!def) return null;
            return (
              <div
                key={fieldKey}
                className="flex flex-col gap-2 w-full lg:w-24 xl:w-28 flex-1 min-w-[80px] animate-fade-in-up"
              >
                <label className="text-xs uppercase tracking-widest text-gray-300 font-bold ml-1 flex items-center truncate">
                  {def.label}
                  {def.unit && (
                    <span className="text-gray-500 lowercase font-normal ml-1">
                      {def.unit}
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  step="0.01"
                  name={fieldKey}
                  value={formData[fieldKey] || ""}
                  onChange={handleChange}
                  placeholder={def.placeholder}
                  className="bg-black/40 border border-white/20 rounded-xl px-3 py-3 text-white text-lg font-mono focus:outline-none focus:ring-0 focus:border-accent-gold transition-colors shadow-inner w-full h-[52px] text-center"
                />
              </div>
            );
          })}

          {/* TOLERÂNCIA */}
          <div className="flex flex-col gap-2 w-full lg:w-20 xl:w-24 flex-none">
            <label className="text-xs uppercase tracking-widest text-gray-400 font-bold ml-1 truncate">
              Tol.
            </label>
            <select
              name="tolerancia"
              value={formData.tolerancia}
              onChange={handleChange}
              className="bg-black/40 border border-white/20 rounded-xl px-2 py-3 text-gray-300 text-sm focus:outline-none focus:ring-0 focus:border-accent-gold transition-colors cursor-pointer text-center h-[52px] w-full"
            >
              <option value="0" className="bg-zinc-900 text-white">± 0.0</option>
              <option value="0.5" className="bg-zinc-900 text-white">± 0.5</option>
              <option value="1.0" className="bg-zinc-900 text-white">± 1.0</option>
              <option value="1.5" className="bg-zinc-900 text-white">± 1.5</option>
              <option value="2.0" className="bg-zinc-900 text-white">± 2.0</option>
              <option value="2.5" className="bg-zinc-900 text-white">± 2.5</option>
              <option value="3.0" className="bg-zinc-900 text-white">± 3.0</option>
              <option value="4.0" className="bg-zinc-900 text-white">± 4.0</option>
              <option value="5.0" className="bg-zinc-900 text-white">± 5.0</option>
              <option value="10.0" className="bg-zinc-900 text-white">± 10.0</option>
            </select>
          </div>

          {/* BUSCAR */}
          <div className="w-full lg:w-auto flex-none">
            <button
              type="submit"
              className="w-full bg-accent-red hover:bg-red-700 text-white font-anton tracking-widest text-lg px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all transform active:scale-95 shadow-lg shadow-accent-red/20 cursor-pointer h-[52px]"
            >
              <Search size={18} />
              BUSCAR
            </button>
          </div>
          
        </div>
      </form>
    </div>
  );
}
