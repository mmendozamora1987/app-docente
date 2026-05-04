import React, { useState, useEffect } from 'react';
import { firebaseConfig } from './firebase';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, where, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import './App.css';

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [grade, setGrade] = useState('');
  const [students, setStudents] = useState([]);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceData, setAttendanceData] = useState({});
  const [activeTab, setActiveTab] = useState('attendance');

  // Autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setGrade('');
    setStudents([]);
  };

  // Cargar estudiantes de Firestore según el grado
  const loadStudents = async (selectedGrade) => {
    if (!selectedGrade || !user) return;
    const q = query(collection(db, 'students'), where('grade', '==', selectedGrade), where('teacherEmail', '==', user.email));
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (list.length === 0) {
      // Estudiantes de ejemplo (los puedes editar después directamente en Firebase)
      const exampleStudents = ['ABRIL ANAYA NICOL VALENTINA', 'ACHURY TABACO LAURA CAMILA', 'AFRICANO PEROZO CARLY RASHELL', 'ALDAZORO MONTILLA LIONEL ANDRES'];
      for (let name of exampleStudents) {
        await addDoc(collection(db, 'students'), { name, grade: selectedGrade, teacherEmail: user.email });
      }
      const newSnapshot = await getDocs(q);
      setStudents(newSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } else {
      setStudents(list);
    }
  };

  // Guardar asistencias
  const saveAttendance = async () => {
    if (!grade) return alert('Selecciona un grado');
    for (let student of students) {
      const status = attendanceData[student.id];
      if (status) {
        const q = query(collection(db, 'attendance'), 
          where('studentId', '==', student.id), 
          where('date', '==', attendanceDate),
          where('teacherEmail', '==', user.email)
        );
        const existing = await getDocs(q);
        if (!existing.empty) {
          await updateDoc(doc(db, 'attendance', existing.docs[0].id), { status });
        } else {
          await addDoc(collection(db, 'attendance'), {
            studentId: student.id,
            studentName: student.name,
            grade,
            date: attendanceDate,
            status,
            teacherEmail: user.email,
            timestamp: new Date()
          });
        }
      }
    }
    alert('Asistencias guardadas');
  };

  if (loading) return <div className="flex justify-center items-center h-screen">Cargando...</div>;
  if (!user) return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <button onClick={handleLogin} className="bg-green-700 hover:bg-green-800 text-white px-6 py-3 rounded-xl text-lg font-bold shadow-lg">
        Ingresar con Google
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200">
      <div className="bg-green-800 text-white p-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">IE Carlos Lleras Restrepo</h1>
            <p className="text-sm opacity-90">{user.displayName} - {user.email}</p>
          </div>
          <button onClick={handleLogout} className="bg-white text-green-800 px-4 py-2 rounded-full text-sm font-bold">Salir</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        {/* Selector de grado */}
        <div className="flex gap-3 mb-6">
          <select
            value={grade}
            onChange={(e) => { setGrade(e.target.value); loadStudents(e.target.value); }}
            className="flex-1 p-3 border rounded-xl shadow-sm bg-white"
          >
            <option value="">-- Selecciona grado --</option>
            <option>7A</option><option>9A</option><option>9B</option><option>9C</option>
            <option>10B</option><option>11A</option><option>11B</option>
          </select>
          <button onClick={() => loadStudents(grade)} className="bg-gray-200 px-4 rounded-xl">Actualizar</button>
        </div>

        {/* Pestañas */}
        <div className="grid grid-cols-3 md:grid-cols-7 gap-2 mb-6">
          {[
            ['attendance', '📋 Lista'],
            ['grades', '📝 Notas'],
            ['observations', '🗒️ Observ.'],
            ['novelties', '📌 Noved.'],
            ['schedule', '🗓️ Calend.'],
            ['history', '🕘 Historial'],
            ['reports', '📤 Reportes']
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`p-3 rounded-xl font-bold text-sm transition ${activeTab === id ? 'bg-green-800 text-white' : 'bg-white text-gray-600 shadow'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Contenido según pestaña activa */}
        <div className="bg-white rounded-2xl shadow-xl p-5">
          {activeTab === 'attendance' && (
            <>
              <div className="mb-4">
                <label className="block text-gray-500 text-sm font-bold mb-2">Fecha de clase</label>
                <input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} className="border p-2 rounded w-full" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-3 text-left">Estudiante</th>
                      <th className="p-3">A</th><th className="p-3">N</th><th className="p-3">T</th><th className="p-3">EXC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(student => (
                      <tr key={student.id} className="border-b">
                        <td className="p-3 font-medium">{student.name}</td>
                        {['A', 'N', 'T', 'E'].map(code => (
                          <td key={code} className="p-2 text-center">
                            <button
                              onClick={() => setAttendanceData({ ...attendanceData, [student.id]: code })}
                              className={`w-12 h-12 rounded-full font-bold transition ${attendanceData[student.id] === code ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}`}
                            >
                              {code === 'E' ? 'EXC' : code}
                            </button>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={saveAttendance} className="mt-6 w-full bg-green-700 hover:bg-green-800 text-white p-3 rounded-xl font-bold">Guardar asistencia</button>
            </>
          )}
          {activeTab !== 'attendance' && (
            <div className="text-center text-gray-400 py-20">
              <p className="text-4xl mb-3">🚧</p>
              <p>Módulo en construcción. Próximamente: notas, observaciones, novedades, calendario, historial y reportes.</p>
              <p className="text-sm mt-2">(Puedo añadir cualquiera de estas funcionalidades en minutos, solo dímelo)</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
