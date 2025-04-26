'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { slugify } from '@/components/utils/slugify';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

export default function RegisterBusiness() {
  const router = useRouter();
  const [images, setImages] = useState<File[]>([]);
  const [cars, setCars] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [menuFile, setMenuFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    business_name: '',
    description: '',
    category: '',
    phone: '',
    email: '',
    whatsapp: '',
    website: '',
    hours: '',
    address: {
      street: '',
      city: '',
      state: '',
      zip: '',
    }
  });

  const isRestaurantOrCatering = form.category.toLowerCase() === 'restaurant' || form.category.toLowerCase() === 'catering';
  const isCarDealership = form.category.toLowerCase() === 'car dealership';
  const isProductBusiness = ['boutique', 'furniture', 'electronics', 'tool rental'].includes(form.category.toLowerCase());

  const handleBusinessImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setImages(Array.from(e.target.files).slice(0, 3));
    }
  };

  const handleMenuFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setMenuFile(e.target.files[0]);
    }
  };

  const handleCarAdd = () => {
    setCars([...cars, { title: '', description: '', price: '', year: '', mileage: '', condition: 'Used', images: [] }]);
  };

  const handleProductAdd = () => {
    setProducts([...products, { title: '', description: '', price: '', images: [] }]);
  };

  const handleCarChange = (index: number, field: string, value: any) => {
    const updatedCars = [...cars];
    updatedCars[index][field] = value;
    setCars(updatedCars);
  };

  const handleProductChange = (index: number, field: string, value: any) => {
    const updatedProducts = [...products];
    updatedProducts[index][field] = value;
    setProducts(updatedProducts);
  };

  const handleCarImageChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files).slice(0, 4);
      const updatedCars = [...cars];
      updatedCars[index].images = selected;
      setCars(updatedCars);
    }
  };

  const handleProductImageChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files).slice(0, 4);
      const updatedProducts = [...products];
      updatedProducts[index].images = selected;
      setProducts(updatedProducts);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    if (id.startsWith('address_')) {
      const key = id.split('_')[1];
      setForm(prev => ({ ...prev, address: { ...prev.address, [key]: value } }));
    } else {
      setForm(prev => ({ ...prev, [id]: value }));
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    const slug = slugify(form.business_name);

    try {
      let businessImageUrls: string[] = [];
      for (const image of images) {
        const filePath = `businesses/${slug}/${Date.now()}-${image.name}`;
        const { data, error } = await supabase.storage.from('business-images').upload(filePath, image);
        if (error) throw error;
        const publicUrl = supabase.storage.from('business-images').getPublicUrl(filePath).data.publicUrl;
        if (publicUrl) businessImageUrls.push(publicUrl);
      }

      let carsData = [];
      if (isCarDealership) {
        for (const car of cars) {
          let carImageUrls: string[] = [];
          for (const image of car.images) {
            const filePath = `businesses/${slug}/cars/${Date.now()}-${image.name}`;
            const { data, error } = await supabase.storage.from('business-images').upload(filePath, image);
            if (error) throw error;
            const publicUrl = supabase.storage.from('business-images').getPublicUrl(filePath).data.publicUrl;
            if (publicUrl) carImageUrls.push(publicUrl);
          }
          carsData.push({ ...car, images: carImageUrls });
        }
      }

      let productsData = [];
      if (isProductBusiness) {
        for (const product of products) {
          let productImageUrls: string[] = [];
          for (const image of product.images) {
            const filePath = `businesses/${slug}/products/${Date.now()}-${image.name}`;
            const { data, error } = await supabase.storage.from('business-images').upload(filePath, image);
            if (error) throw error;
            const publicUrl = supabase.storage.from('business-images').getPublicUrl(filePath).data.publicUrl;
            if (publicUrl) productImageUrls.push(publicUrl);
          }
          productsData.push({ ...product, images: productImageUrls });
        }
      }

      let menuUrl = '';
      if (isRestaurantOrCatering && menuFile) {
        const filePath = `businesses/${slug}/menu-${Date.now()}.pdf`;
        const { data, error } = await supabase.storage.from('business-images').upload(filePath, menuFile);
        if (error) throw error;
        menuUrl = supabase.storage.from('business-images').getPublicUrl(filePath).data.publicUrl || '';
      }

      const businessData = {
        business_name: form.business_name,
        slug: slug,
        description: form.description,
        category: form.category,
        phone: form.phone,
        email: form.email,
        whatsapp: form.whatsapp,
        website: form.website,
        hours: form.hours,
        address: form.address,
        images: businessImageUrls,
        menu_url: menuUrl || null,
        cars: isCarDealership ? carsData : null,
        products: isProductBusiness ? productsData : null,
        isRestaurantOrCatering,
      };

      const { error } = await supabase.from('Businesses').insert([businessData]);

      if (error) throw error;

      toast.success('Business registered successfully!');
      router.push(`/business/${slug}`);
    } catch (error: any) {
      console.error(error.message);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>Register Business Page (Form Inputs Coming Here)</div>
  );
}
