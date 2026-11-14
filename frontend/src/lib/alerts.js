import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import logo from '../assets/logo.png'

export const alertOptions = {
  customClass: {
    popup: 'sanroman-alert',
    confirmButton: 'sanroman-alert-confirm',
    cancelButton: 'sanroman-alert-cancel',
    input: 'sanroman-alert-input',
  },
  buttonsStyling: false,
}

export const notifySuccess = (title, text = '') => Swal.fire({
  ...alertOptions,
  icon: 'success',
  title,
  text,
  timer: 1800,
  showConfirmButton: false,
})

export const notifyError = (text) => Swal.fire({
  ...alertOptions,
  icon: 'error',
  title: 'No se pudo completar',
  text,
})

export const notifyWarning = (title, text) => Swal.fire({
  ...alertOptions,
  icon: 'warning',
  title,
  text,
})

export const confirmAction = (title, text, confirmButtonText = 'Confirmar') => Swal.fire({
  ...alertOptions,
  imageUrl: logo,
  imageWidth: 112,
  imageAlt: 'Transporte San Román',
  title,
  text,
  showCancelButton: true,
  confirmButtonText,
  cancelButtonText: 'Cancelar',
  reverseButtons: true,
})

export const requestNumber = (title, value = '', placeholder = '0.00') => Swal.fire({
  ...alertOptions,
  title,
  input: 'number',
  inputValue: value,
  inputPlaceholder: placeholder,
  inputAttributes: { min: '0', step: '0.01' },
  showCancelButton: true,
  confirmButtonText: 'Guardar',
  cancelButtonText: 'Cancelar',
  reverseButtons: true,
  inputValidator: (inputValue) => (inputValue === '' || Number(inputValue) < 0 ? 'Ingresa un monto valido' : undefined),
})
