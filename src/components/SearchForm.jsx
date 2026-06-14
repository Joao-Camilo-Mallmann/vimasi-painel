import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import CATEGORIES, { FIELD_DEFS, getFieldsForTipo } from "../config/categories";
import DatabaseService from "../services/DatabaseService";

export default function SearchForm({ onSearch }) {
  const [tiposDisponiveis, setTiposDisponiveis] = useState([]);
  const [contagem, setContagem] = useState({});
  const [formData, setFormData] = useState({
    tipo: "",
    tolerancia: "0.5",
  });

  useEffect(() => {
    DatabaseService.getTipos().then(setTiposDisponiveis);
    DatabaseService.getContagemPorTipo().then(setContagem);
  }, []);

  // Campos de busca dinâmicos baseados no tipo selecionado
  const activeFields = useMemo(
    () => getFieldsForTipo(formData.tipo),
    [formData.tipo],
  );

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Montar params apenas com campos ativos
    const params = {
      tipo: formData.tipo,
      tolerancia: formData.tolerancia,
    };
    for (const field of activeFields) {
      if (formData[field]) {
        params[field] = formData[field];
      }
    }
    onSearch(params);
  };

  return (
    <div className="glass rounded-2xl p-4 md:p-6 w-full max-w-6xl mx-auto relative z-10">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
        {/* Linha 1: Tipo + Tolerância */}
        <div className="flex flex-col md:flex-row items-end gap-4 w-full">
          {/* TIPO */}
          <div className="flex flex-col gap-2 w-full md:w-52 flex-none">
            <label className="text-xs uppercase tracking-widest text-gray-400 font-bold ml-1">
              Tipo / Categoria
            </label>
            <select
              name="tipo"
              value={formData.tipo}
              onChange={handleChange}
              className="bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-0 focus:border-accent-gold transition-colors shadow-inner cursor-pointer"
            >
              <option
                value=""
                className="bg-zinc-900 text-white border-none outline-none"
              >
                Todos
              </option>
              {tiposDisponiveis.map((tipo) => {
                const cat = CATEGORIES.find((c) => c.tipo === tipo);
                const label = cat ? cat.label : tipo;

                return (
                  <option
                    key={tipo}
                    value={tipo}
                    className="bg-zinc-900 text-white border-none outline-none"
                  >
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          {/* CAMPOS DINÂMICOS */}
          {activeFields.map((fieldKey) => {
            const def = FIELD_DEFS[fieldKey];
            if (!def) return null;
            return (
              <div
                key={fieldKey}
                className="flex flex-col gap-2 flex-1 animate-fade-in-up"
              >
                <label className="text-xs uppercase tracking-widest text-gray-300 font-bold ml-1">
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
                  className="bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white text-xl font-mono focus:outline-none focus:ring-0 focus:border-accent-gold transition-colors shadow-inner w-full"
                />
              </div>
            );
          })}

          {/* TOLERÂNCIA */}
          <div className="flex flex-col gap-2 w-full md:w-28 flex-none">
            <label className="text-xs uppercase tracking-widest text-gray-400 font-bold ml-1">
              Tol.
            </label>
            <select
              name="tolerancia"
              value={formData.tolerancia}
              onChange={handleChange}
              className="bg-black/40 border border-white/20 rounded-xl px-3 py-3 text-gray-300 text-sm focus:outline-none focus:ring-0 focus:border-accent-gold transition-colors cursor-pointer text-center"
            >
              <option value="0" className="bg-zinc-900 text-white">
                ± 0.0
              </option>
              <option value="0.5" className="bg-zinc-900 text-white">
                ± 0.5
              </option>
              <option value="1.0" className="bg-zinc-900 text-white">
                ± 1.0
              </option>
              <option value="1.5" className="bg-zinc-900 text-white">
                ± 1.5
              </option>
              <option value="2.0" className="bg-zinc-900 text-white">
                ± 2.0
              </option>
              <option value="2.5" className="bg-zinc-900 text-white">
                ± 2.5
              </option>
              <option value="3.0" className="bg-zinc-900 text-white">
                ± 3.0
              </option>
              <option value="4.0" className="bg-zinc-900 text-white">
                ± 4.0
              </option>
              <option value="5.0" className="bg-zinc-900 text-white">
                ± 5.0
              </option>
              <option value="10.0" className="bg-zinc-900 text-white">
                ± 10.0
              </option>
            </select>
          </div>

          {/* BUSCAR */}
          <div className="flex-none w-full md:w-auto">
            <button
              type="submit"
              className="w-full md:w-auto bg-accent-red hover:bg-red-700 text-white font-anton tracking-widest text-lg px-8 py-3 rounded-xl flex items-center justify-center gap-2 transition-all transform active:scale-95 shadow-lg shadow-accent-red/20 cursor-pointer h-[52px]"
            >
              <Search size={20} />
              BUSCAR
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
