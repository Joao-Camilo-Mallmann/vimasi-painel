import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import DatabaseService from "../services/DatabaseService";

export default function SearchForm({ onSearch }) {
  const [tiposDisponiveis, setTiposDisponiveis] = useState([]);
  const [formData, setFormData] = useState({
    tipo: "",
    interno: "",
    externo: "",
    altura: "",
    tolerancia: "0.5",
  });

  useEffect(() => {
    DatabaseService.getTipos().then(setTiposDisponiveis);
  }, []);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(formData);
  };

  return (
    <div className="glass rounded-2xl p-4 md:p-6 w-full max-w-6xl mx-auto relative z-10">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col md:flex-row items-end gap-4 w-full"
      >
        {/* TIPO */}
        <div className="flex flex-col gap-2 w-full md:w-40 flex-none">
          <label className="text-xs uppercase tracking-widest text-gray-400 font-bold ml-1">
            Tipo
          </label>
          <select
            name="tipo"
            value={formData.tipo}
            onChange={handleChange}
            className="bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-0 focus:border-accent-gold transition-colors shadow-inner cursor-pointer"
          >
            <option
              value=""
              className="bg-zinc-800 text-white border-none outline-none"
            >
              Todos
            </option>
            {tiposDisponiveis.map((t, idx) => (
              <option
                key={idx}
                value={t}
                className="bg-zinc-800 text-white border-none outline-none"
              >
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* INTERNO */}
        <div className="flex flex-col gap-2 flex-1">
          <label className="text-xs uppercase tracking-widest text-gray-300 font-bold ml-1">
            Ø Interno
          </label>
          <input
            type="number"
            step="0.01"
            name="interno"
            value={formData.interno}
            onChange={handleChange}
            placeholder="0.00"
            className="bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white text-xl font-mono focus:outline-none focus:ring-0 focus:border-accent-gold transition-colors shadow-inner w-full"
          />
        </div>

        {/* EXTERNO */}
        <div className="flex flex-col gap-2 flex-1">
          <label className="text-xs uppercase tracking-widest text-gray-300 font-bold ml-1">
            Ø Externo
          </label>
          <input
            type="number"
            step="0.01"
            name="externo"
            value={formData.externo}
            onChange={handleChange}
            placeholder="0.00"
            className="bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white text-xl font-mono focus:outline-none focus:ring-0 focus:border-accent-gold transition-colors shadow-inner w-full"
          />
        </div>

        {/* ALTURA TOTAL */}
        <div className="flex flex-col gap-2 flex-1">
          <label className="text-xs uppercase tracking-widest text-gray-300 font-bold ml-1">
            Alt. Total
          </label>
          <input
            type="number"
            step="0.01"
            name="altura"
            value={formData.altura}
            onChange={handleChange}
            placeholder="0.00"
            className="bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white text-xl font-mono focus:outline-none focus:ring-0 focus:border-accent-gold transition-colors shadow-inner w-full"
          />
        </div>

        {/* ALTURA BASE (CONDICIONAL PARA ZW) */}
        {formData.tipo === 'ZW' && (
          <div className="flex flex-col gap-2 flex-1 animate-fade-in-up">
            <label className="text-xs uppercase tracking-widest text-gray-300 font-bold ml-1 text-accent-gold">Alt. Base</label>
            <input 
              type="number" 
              step="0.01"
              name="alturaBase"
              value={formData.alturaBase || ''}
              onChange={handleChange}
              placeholder="0.00"
              className="bg-black/40 border border-accent-gold/40 rounded-xl px-4 py-3 text-white text-xl font-mono focus:outline-none focus:ring-0 focus:border-accent-gold transition-colors shadow-inner w-full"
            />
          </div>
        )}

        {/* TOLERANCIA */}
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
            <option
              value="0"
              className="bg-zinc-800 text-white border-none outline-none"
            >
              ± 0.0
            </option>
            <option
              value="0.2"
              className="bg-zinc-800 text-white border-none outline-none"
            >
              ± 0.2
            </option>
            <option
              value="0.5"
              className="bg-zinc-800 text-white border-none outline-none"
            >
              ± 0.5
            </option>
            <option
              value="1.0"
              className="bg-zinc-800 text-white border-none outline-none"
            >
              ± 1.0
            </option>
            <option value="1.5" className="bg-zinc-800 text-white">
              ± 1.5
            </option>
            <option value="2.0" className="bg-zinc-800 text-white">
              ± 2.0
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
      </form>
    </div>
  );
}
