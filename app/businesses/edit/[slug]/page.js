'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { FaTrash } from 'react-icons/fa';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import { CSS } from '@dnd-kit/utilities';

function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}
export default function EditBusinessPage() {
    const { slug } = useParams();
    const router = useRouter();
    const [form, setForm] = useState(null);
  
    useEffect(() => {
      setForm({
        name: 'Bolani House',
        slug: 'bolani-house',
        description: '',
        category: 'Restaurant',
        address: '',
        contact: { whatsapp: '', phone: '', email: '' },
        hours: {
            Mon: '07:00 AM - 09:00 PM',
            Tue: '07:00 AM - 09:00 PM',
            Wed: '07:00 AM - 09:00 PM',
            Thu: '07:00 AM - 09:00 PM',
            Fri: '07:00 AM - 09:00 PM',
            Sat: '07:00 AM - 09:00 PM',
            Sun: 'Closed',
            
          },
          
          
        menu: [],
        listings: [],
      });
    }, [slug]);
  
    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));
  
    const handleDragEnd = (event, key) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
  
      setForm((prev) => {
        const items = [...prev[key]];
        const oldIndex = items.findIndex((item, i) => `${key}-${i}` === active.id);
        const newIndex = items.findIndex((item, i) => `${key}-${i}` === over.id);
        return {
          ...prev,
          [key]: arrayMove(items, oldIndex, newIndex),
        };
      });
    };
    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name.startsWith('contact.')) {
          const key = name.split('.')[1];
          setForm((prev) => ({
            ...prev,
            contact: { ...prev.contact, [key]: value },
          }));
        } else if (name.startsWith('hours.')) {
          const key = name.split('.')[1];
          setForm((prev) => ({
            ...prev,
            hours: { ...prev.hours, [key]: value },
          }));
        } else {
          setForm((prev) => ({ ...prev, [name]: value }));
        }
      };
    
      const handleAddMenuItem = () =>
        setForm((prev) => ({
          ...prev,
          menu: [...prev.menu, { name: '', price: '', description: '', preview: null }],
        }));
    
      const handleMenuChange = (index, field, value) => {
        const updated = [...form.menu];
        updated[index][field] = value;
        setForm((prev) => ({ ...prev, menu: updated }));
      };
    
      const handleMenuImageChange = (index, file) => {
        const updated = [...form.menu];
        updated[index].preview = URL.createObjectURL(file);
        setForm((prev) => ({ ...prev, menu: updated }));
      };
    
      const handleRemoveMenuItem = (index) => {
        const updated = [...form.menu];
        updated.splice(index, 1);
        setForm((prev) => ({ ...prev, menu: updated }));
      };
    
      const handleAddListing = () =>
        setForm((prev) => ({
          ...prev,
          listings: [...prev.listings, { title: '', price: '', description: '', photoDescription: '', preview: null }],
        }));
    
      const handleListingChange = (index, field, value) => {
        const updated = [...form.listings];
        updated[index][field] = value;
        setForm((prev) => ({ ...prev, listings: updated }));
      };
    
      const handleListingImageChange = (index, file) => {
        const updated = [...form.listings];
        updated[index].preview = URL.createObjectURL(file);
        setForm((prev) => ({ ...prev, listings: updated }));
      };
    
      const handleRemoveListing = (index) => {
        const updated = [...form.listings];
        updated.splice(index, 1);
        setForm((prev) => ({ ...prev, listings: updated }));
      };
    
      const handleSubmit = (e) => {
        e.preventDefault();
        console.log('Submitted:', form);
        alert('Business updated!');
        router.push(`/businesses/${form.slug}`);
      };
    
      if (!form) return <div className="p-6">Loading...</div>;
    
      const isRestaurant = form.category.toLowerCase().includes('restaurant');
      const isLister = ['car', 'dealership', 'vendor', 'store'].some((w) =>
        form.category.toLowerCase().includes(w)
      );
    
      return (
        <div className="max-w-2xl mx-auto p-4 text-sm">
          <h1 className="text-xl font-semibold mb-4">Edit Business</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input name="name" value={form.name} onChange={handleChange} className="w-full border px-2 py-1 rounded" placeholder="Business Name" />
            <textarea name="description" value={form.description} onChange={handleChange} rows={2} className="w-full border px-2 py-1 rounded" placeholder="Description" />
            <input name="category" value={form.category} onChange={handleChange} className="w-full border px-2 py-1 rounded" placeholder="Category" />
            <input name="address" value={form.address} onChange={handleChange} className="w-full border px-2 py-1 rounded" placeholder="Address" />
    
            <div className="bg-gray-100 p-3 rounded">
              <h2 className="font-semibold mb-2">Contact</h2>
              <input name="contact.whatsapp" value={form.contact.whatsapp} onChange={handleChange} className="w-full border px-2 py-1 rounded mb-2" placeholder="WhatsApp" />
              <input name="contact.phone" value={form.contact.phone} onChange={handleChange} className="w-full border px-2 py-1 rounded mb-2" placeholder="Phone" />
              <input name="contact.email" value={form.contact.email} onChange={handleChange} className="w-full border px-2 py-1 rounded" placeholder="Email" />
            </div>
            <div className="bg-gray-100 p-3 rounded">
          <h2 className="font-semibold mb-2">Hours of Operation</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(form.hours).map(([day, value]) => (
              <div key={day} className="flex items-center gap-2">
                <span className="w-14 font-medium text-gray-700">{day}:</span>
                <input
  name={`hours.${day}`}
  value={value}
  onChange={handleChange}
  className="flex-1 border px-2 py-1 rounded text-sm text-gray-700"
  placeholder="07:00 AM - 09:00 PM"
/>

              </div>
            ))}
          </div>
        </div>

            {isRestaurant && (
          <div className="bg-gray-100 p-3 rounded">
            <h2 className="font-semibold mb-2">Menu Items</h2>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, 'menu')}>
              <SortableContext items={form.menu.map((_, i) => `menu-${i}`)} strategy={verticalListSortingStrategy}>
                {form.menu.map((item, i) => (
                  <SortableItem key={`menu-${i}`} id={`menu-${i}`}>
                    <div className="border p-3 mb-3 bg-white rounded">
                      <input
                        value={item.name}
                        onChange={(e) => handleMenuChange(i, 'name', e.target.value)}
                        placeholder="Item Name"
                        className="w-full border px-2 py-1 rounded mb-2"
                      />
                      <input
                        value={item.price}
                        onChange={(e) => handleMenuChange(i, 'price', e.target.value)}
                        placeholder="Price"
                        className="w-full border px-2 py-1 rounded mb-2"
                      />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleMenuImageChange(i, e.target.files[0])}
                        className="w-full border px-2 py-1 rounded mb-2"
                      />
                      {item.preview && <img src={item.preview} className="w-24 h-24 object-cover rounded mb-2" />}
                      <textarea
                        placeholder="Description"
                        className="w-full border px-2 py-1 rounded"
                        value={item.description}
                        onChange={(e) => handleMenuChange(i, 'description', e.target.value)}
                      />
                      <button type="button" onClick={() => handleRemoveMenuItem(i)} className="text-red-500 text-xs mt-2">
                        <FaTrash className="inline" /> Remove
                      </button>
                    </div>
                  </SortableItem>
                ))}
              </SortableContext>
            </DndContext>
            <button type="button" onClick={handleAddMenuItem} className="text-blue-600 text-sm">
              + Add Menu Item
            </button>
          </div>
        )}

        {isLister && (
          <div className="bg-gray-100 p-3 rounded">
            <h2 className="font-semibold mb-2">Item Listings</h2>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, 'listings')}>
              <SortableContext items={form.listings.map((_, i) => `listings-${i}`)} strategy={verticalListSortingStrategy}>
                {form.listings.map((item, i) => (
                  <SortableItem key={`listings-${i}`} id={`listings-${i}`}>
                    <div className="border p-3 mb-3 bg-white rounded space-y-2">
                      <input
                        value={item.title}
                        onChange={(e) => handleListingChange(i, 'title', e.target.value)}
                        placeholder="Title"
                        className="w-full border px-2 py-1 rounded"
                      />
                      <input
                        value={item.price}
                        onChange={(e) => handleListingChange(i, 'price', e.target.value)}
                        placeholder="Price"
                        className="w-full border px-2 py-1 rounded"
                      />
                      <textarea
                        value={item.description}
                        onChange={(e) => handleListingChange(i, 'description', e.target.value)}
                        placeholder="Item Description"
                        className="w-full border px-2 py-1 rounded"
                        rows={2}
                      />
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => handleListingImageChange(i, e.target.files[0])}
                        className="w-full border px-2 py-1 rounded"
                      />
                      {item.preview && <img src={item.preview} className="w-24 h-24 object-cover rounded" />}
                      <textarea
                        placeholder="Photo Description"
                        value={item.photoDescription}
                        onChange={(e) => handleListingChange(i, 'photoDescription', e.target.value)}
                        className="w-full border px-2 py-1 rounded text-sm"
                        rows={2}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveListing(i)}
                        className="text-red-600 text-xs mt-2 inline-flex items-center gap-1"
                      >
                        <FaTrash /> Remove
                      </button>
                    </div>
                  </SortableItem>
                ))}
              </SortableContext>
            </DndContext>
            <button type="button" onClick={handleAddListing} className="text-blue-600 text-sm">
              + Add Item Listing
            </button>
          </div>
        )}

        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm mt-4">
          Save Changes
        </button>
      </form>
    </div>
  );
}
