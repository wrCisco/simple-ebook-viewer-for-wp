const { __, _x, _n, sprintf } = wp.i18n;

export function colorFiltersDialog(bookContainer, appliedFilters, fixedLayout = false) {
    const dlg = document.createElement('dialog')
    const form = document.createElement('form')
    form.setAttribute('method', 'dialog')

    const p1 = document.createElement('p')
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.id = 'simebv-activate-color-filter'
    checkbox.setAttribute('autofocus', 'true')
    const checkboxLabel = document.createElement('label')
    checkboxLabel.htmlFor = 'simebv-activate-color-filter'
    checkboxLabel.innerText = __('Activate color filters', 'simple-ebook-viewer')
    if (appliedFilters?.activateColorFilter) {
        checkbox.checked = true
    }
    p1.append(checkbox, ' ', checkboxLabel)

    const p2 = document.createElement('p')
    const invertFilter = document.createElement('input')
    invertFilter.id = 'simebv-invert-colors-filter'
    invertFilter.type = 'range'
    invertFilter.setAttribute('min', 0)
    invertFilter.setAttribute('max', 1)
    invertFilter.setAttribute('step', 0.01)
    invertFilter.setAttribute('disabled', 'true')
    invertFilter.value = appliedFilters?.invertColorsFilter ?? 0
    const invertFilterLabel = document.createElement('label')
    invertFilterLabel.innerText = __('Invert colors:', 'simple-ebook-viewer')
    invertFilterLabel.htmlFor = 'simebv-invert-colors-filter'
    invertFilterLabel.classList.add('simebv-label-disabled')
    p2.append(invertFilterLabel, ' ', invertFilter)

    const p3 = document.createElement('p')
    const rotateFilter = document.createElement('input')
    rotateFilter.id = 'simebv-rotate-colors-filter'
    rotateFilter.type = 'range'
    rotateFilter.setAttribute('min', 0)
    rotateFilter.setAttribute('max', 360)
    rotateFilter.setAttribute('disabled', 'true')
    rotateFilter.value = appliedFilters?.rotateColorsFilter ?? 0
    const rotateFilterLabel = document.createElement('label')
    rotateFilterLabel.innerText = __('Rotate hues:', 'simple-ebook-viewer')
    rotateFilterLabel.htmlFor = 'simebv-rotate-colors-filter'
    rotateFilterLabel.classList.add('simebv-label-disabled')
    p3.append(rotateFilterLabel, ' ', rotateFilter)

    const p4 = document.createElement('p')
    const bgFilterTransparent = document.createElement('input')
    bgFilterTransparent.id = 'simebv-bg-transparent-filter'
    bgFilterTransparent.type = 'checkbox'
    bgFilterTransparent.setAttribute('disabled', 'true')
    bgFilterTransparent.checked = appliedFilters?.bgFilterTransparent ?? true
    const bgFilterTransparentLabel = document.createElement('label')
    bgFilterTransparentLabel.innerText = __('Transparent background:', 'simple-ebook-viewer')
    bgFilterTransparentLabel.htmlFor = 'simebv-bg-transparent-filter'
    bgFilterTransparentLabel.classList.add('simebv-label-disabled')
    p4.append(bgFilterTransparentLabel, ' ', bgFilterTransparent)

    const p5 = document.createElement('p')
    const bgFilter = document.createElement('input')
    bgFilter.id = 'simebv-bg-color-filter'
    bgFilter.type = 'color'
    bgFilter.setAttribute('disabled', 'true')
    bgFilter.value = appliedFilters?.bgColorsFilter ?? '#FFFFFF'
    const bgFilterLabel = document.createElement('label')
    bgFilterLabel.innerText = __('Background color:', 'simple-ebook-viewer')
    bgFilterLabel.htmlFor = 'simebv-bg-color-filter'
    bgFilterLabel.classList.add('simebv-label-disabled')
    p5.append(bgFilterLabel, ' ', bgFilter)

    const closeButton = document.createElement('button')
    closeButton.type = 'submit'
    closeButton.innerText = __('OK', 'simple-ebook-viewer')

    const updateFilter = () => {
        if (appliedFilters && !invertFilter.disabled) {
            appliedFilters.invertColorsFilter = invertFilter.value
            appliedFilters.rotateColorsFilter = rotateFilter.value
            if (!fixedLayout) {
                appliedFilters.bgFilterTransparent = bgFilterTransparent.checked
                if (!bgFilterTransparent.checked) {
                    appliedFilters.bgColorsFilter = bgFilter.value
                }
            }
        }
        const val = invertFilter.disabled ? 'none' : `invert(${invertFilter.value}) hue-rotate(${rotateFilter.value}deg)`
        const book = bookContainer.querySelector('foliate-view')
        if (book && !fixedLayout) {
            const bg = bgFilter.disabled ? 'transparent' : bgFilter.value
            book.style.setProperty('--book-bg-color', bg)
        }
        bookContainer.style.setProperty('--book-colors-filter', val)
    }

    const updateEnabled = () => {
        // invertFilter.disabled = !checkbox.checked
        // rotateFilter.disabled = !checkbox.checked
        // if (!fixedLayout) {
        //     bgFilterTransparent.disabled = !checkbox.checked
        //     bgFilter.disabled = !checkbox.checked || bgFilterTransparent.checked
        // }
        if (checkbox.checked) {
            invertFilter.disabled = false
            invertFilterLabel.classList.remove('simebv-disabled-label')
            rotateFilter.disabled = false
            rotateFilterLabel.classList.remove('simebv-disabled-label')
            if (!fixedLayout) {
                bgFilterTransparent.disabled = false
                bgFilterTransparentLabel.classList.remove('simebv-disabled-label')
                bgFilter.disabled = bgFilterTransparent.checked
                if (!bgFilter.disabled) {
                    bgFilterLabel.classList.remove('simebv-disabled-label')
                }
            }
        }
        else {
            invertFilter.disabled = true
            invertFilterLabel.classList.add('simebv-disabled-label')
            rotateFilter.disabled = true
            rotateFilterLabel.classList.add('simebv-disabled-label')
            if (!fixedLayout) {
                bgFilterTransparent.disabled = true
                bgFilterTransparentLabel.classList.add('simebv-disabled-label')
                bgFilter.disabled = true
                bgFilterLabel.classList.add('simebv-disabled-label')
            }
        }
    }

    checkbox.addEventListener('change', () => {
        if (appliedFilters) {
            appliedFilters.activateColorFilter = checkbox.checked
        }
        updateEnabled()
        updateFilter()
    })
    invertFilter.addEventListener('change', updateFilter)
    rotateFilter.addEventListener('change', updateFilter)
    bgFilterTransparent.addEventListener('change', () => {
        bgFilter.disabled = bgFilterTransparent.checked
        bgFilterLabel.classList.toggle('simebv-disabled-label')
        updateFilter()
    })
    bgFilter.addEventListener('change', updateFilter)

    form.append(p1, p2, p3, p4, p5, closeButton)
    dlg.append(form)

    if (fixedLayout) {
        p4.style.display = 'none'
        p5.style.display = 'none'
    }

    updateEnabled()
    updateFilter()

    return dlg
}
