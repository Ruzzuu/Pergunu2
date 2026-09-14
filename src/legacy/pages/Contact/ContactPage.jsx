import React from 'react';
import { FaEnvelope, FaMapMarkerAlt, FaPhoneAlt, FaWhatsapp } from 'react-icons/fa';
import Navbar from '../../componen/Navbar/Navbar';
import Footer from '../../componen/Footer/Footer';
import './ContactPage.css';

const whatsappUrl = 'https://wa.me/6289631011926';

export default function ContactPage() {
  return <div className="contact-page">
    <Navbar />
    <main className="contact-main">
      <section className="contact-hero"><div className="contact-shell"><p>Hubungi PERGUNU</p><h1>Mari terhubung dan berkolaborasi</h1><span>Tim PERGUNU Situbondo siap membantu pertanyaan seputar keanggotaan, kegiatan, dan kemitraan.</span></div></section>
      <section className="contact-shell contact-grid">
        <a className="contact-card" href="tel:+6289631011926"><FaPhoneAlt /><div><small>Telepon</small><strong>+62 896 3101 1926</strong><span>Hubungi kami melalui panggilan.</span></div></a>
        <a className="contact-card" href="mailto:mediapergunusitubondo@gmail.com"><FaEnvelope /><div><small>Email</small><strong>mediapergunusitubondo@gmail.com</strong><span>Kirim pertanyaan atau proposal Anda.</span></div></a>
        <a className="contact-card contact-card-primary" href={whatsappUrl} target="_blank" rel="noreferrer"><FaWhatsapp /><div><small>WhatsApp</small><strong>Chat admin PERGUNU</strong><span>Dapatkan respons melalui WhatsApp.</span></div></a>
        <div className="contact-card"><FaMapMarkerAlt /><div><small>Kantor</small><strong>PCNU Situbondo</strong><span>Jl. Madura No. 79, Mimbaan, Situbondo. Sebelah timur Terminal Situbondo.</span></div></div>
      </section>
    </main>
    <Footer />
  </div>;
}
