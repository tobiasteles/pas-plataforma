 "use client";
 import { useState, useTransition } from "react";
 import { adicionarVariasNaLista } from "@/actions/lists";
 
 type Props = {
   lists: { id: number; name: string }[];
   questionIds: string[];
 };
 
 export default function QuestionSelector({ lists, questionIds }: Props) {
   const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
   const [listId, setListId] = useState(lists[0]?.id ?? 0);
   const [done, setDone] = useState(false);
   const [p, go] = useTransition();
 
   const toggleAll = () => {
     if (selectedIds.size === questionIds.length) {
       setSelectedIds(new Set());
     } else {
       setSelectedIds(new Set(questionIds));
     }
   };
 
   const toggleOne = (id: string) => {
     const next = new Set(selectedIds);
     if (next.has(id)) next.delete(id);
     else next.add(id);
     setSelectedIds(next);
   };
 
   const handleBulkAdd = () => {
     if (!selectedIds.size) return;
     setDone(false);
     go(async () => {
       await adicionarVariasNaLista(listId, Array.from(selectedIds));
       setDone(true);
       setSelectedIds(new Set());
     });
   };
 
   if (!lists.length) {
     return (
       <div className="card p-3 text-center text-sm text-stone-500">
         <a href="/listas" className="underline">Crie uma lista</a> para usar a seleção em lote.
       </div>
     );
   }
 
   return (
     <div className="card space-y-3">
       <div className="flex flex-wrap items-center gap-3 text-sm">
         <label className="flex items-center gap-2 cursor-pointer">
           <input
             type="checkbox"
             checked={selectedIds.size === questionIds.length && questionIds.length > 0}
             indeterminate={selectedIds.size > 0 && selectedIds.size < questionIds.length}
             onChange={toggleAll}
             className="w-4 h-4 rounded border-stone-300"
           />
           <span className="font-medium">
             {selectedIds.size === questionIds.length && questionIds.length > 0
               ? "Desmarcar todas"
               : `Selecionar todas (${questionIds.length})`}
           </span>
         </label>
 
         <span className="text-stone-500 ml-auto">
           {selectedIds.size} selecionada{selectedIds.size !== 1 ? "s" : ""}
         </span>
       </div>
 
       <div className="flex flex-wrap items-center gap-2">
         <select
           className="input w-auto py-1"
           value={listId}
           onChange={(e) => setListId(+e.target.value)}
         >
           {lists.map((l) => (
             <option key={l.id} value={l.id}>{l.name}</option>
           ))}
         </select>
 
         <button
           className="btn btn-primary"
           disabled={p || selectedIds.size === 0}
           onClick={handleBulkAdd}
         >
           {p ? "Adicionando..." : done ? "✓ Adicionadas!" : `+ Adicionar ${selectedIds.size} à lista`}
         </button>
 
         {done && (
           <span className="text-sm text-green-600 animate-pulse">
             {selectedIds.size} questão{selectedIds.size !== 1 ? "ões" : ""} adicionada{selectedIds.size !== 1 ? "s" : ""}!
           </span>
         )}
       </div>
     </div>
   );
 }
