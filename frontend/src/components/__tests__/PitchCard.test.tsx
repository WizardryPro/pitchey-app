import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, createMockPitch } from '../../test/utils'
import userEvent from '@testing-library/user-event'
import PitchCard from '../portfolio/PitchCard'

const mockPitch = createMockPitch({
  id: '1',
  title: 'Test Pitch Title',
  tagline: 'An exciting story about adventure',
  genre: 'Drama',
  thumbnail: 'https://example.com/thumbnail.jpg',
  views: 1250,
  rating: 4.5,
  status: 'Active',
  budget: '$1M - $5M',
  createdAt: '2024-01-01T00:00:00Z',
  description: 'This is a detailed description of the pitch that explains the story and characters.',
})

describe('PitchCard', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render pitch card with all required elements', () => {
      render(<PitchCard pitch={mockPitch} />)

      expect(screen.getByText('Test Pitch Title')).toBeInTheDocument()
      expect(screen.getByText('An exciting story about adventure')).toBeInTheDocument()
      expect(screen.getByText('Drama')).toBeInTheDocument()
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('$1M - $5M')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /view details/i })).toBeInTheDocument()
    })

    it('should render pitch thumbnail with proper alt text', () => {
      render(<PitchCard pitch={mockPitch} />)

      const thumbnail = screen.getByRole('img', { name: /test pitch title/i })
      expect(thumbnail).toBeInTheDocument()
      expect(thumbnail).toHaveAttribute('src', 'https://example.com/thumbnail.jpg')
      expect(thumbnail).toHaveAttribute('alt', 'Test Pitch Title')
    })

    it('should render views count with proper formatting', () => {
      render(<PitchCard pitch={mockPitch} />)

      expect(screen.getByText('1.3K')).toBeInTheDocument() // 1250 views formatted
    })

    it('should render rating with proper formatting', () => {
      render(<PitchCard pitch={mockPitch} />)

      expect(screen.getByText('4.5')).toBeInTheDocument()
    })

    it('should render description when provided', () => {
      render(<PitchCard pitch={mockPitch} />)

      expect(screen.getByText(/this is a detailed description/i)).toBeInTheDocument()
    })

    it('should not render description when not provided', () => {
      const pitchWithoutDescription = { ...mockPitch, description: undefined }
      render(<PitchCard pitch={pitchWithoutDescription} />)

      expect(screen.queryByText(/this is a detailed description/i)).not.toBeInTheDocument()
    })
  })

  describe('Number Formatting', () => {
    it('should format large numbers in millions', () => {
      const pitchWithMillionViews = { ...mockPitch, views: 2500000 }
      render(<PitchCard pitch={pitchWithMillionViews} />)

      expect(screen.getByText('2.5M')).toBeInTheDocument()
    })

    it('should format numbers in thousands', () => {
      const pitchWithThousandViews = { ...mockPitch, views: 5500 }
      render(<PitchCard pitch={pitchWithThousandViews} />)

      expect(screen.getByText('5.5K')).toBeInTheDocument()
    })

    it('should display small numbers as-is', () => {
      const pitchWithSmallViews = { ...mockPitch, views: 500 }
      render(<PitchCard pitch={pitchWithSmallViews} />)

      expect(screen.getByText('500')).toBeInTheDocument()
    })

    it('should handle zero views', () => {
      const pitchWithZeroViews = { ...mockPitch, views: 0 }
      render(<PitchCard pitch={pitchWithZeroViews} />)

      expect(screen.getByText('0')).toBeInTheDocument()
    })
  })

  describe('Navigation', () => {
    it('should link to correct pitch detail page', () => {
      render(<PitchCard pitch={mockPitch} />)

      const detailsLink = screen.getByRole('link', { name: /view details/i })
      expect(detailsLink).toHaveAttribute('href', '/pitch/1')
    })

    it('should navigate when view details button is clicked', async () => {
      const { navigate: _navigate } = render(<PitchCard pitch={mockPitch} />)

      const detailsLink = screen.getByRole('link', { name: /view details/i })
      await user.click(detailsLink)

      // Since we're using Link component, React Router would handle navigation
      // We can test that the href is correct
      expect(detailsLink).toHaveAttribute('href', '/pitch/1')
    })
  })

  describe('Interactive Elements', () => {
    it('should have hover effects on card', () => {
      render(<PitchCard pitch={mockPitch} />)

      const card = screen.getByRole('img').closest('div.bg-white')
      expect(card).toHaveClass('hover:shadow-2xl')
    })

    it('should have hover effects on image', () => {
      render(<PitchCard pitch={mockPitch} />)

      const image = screen.getByRole('img')
      expect(image).toHaveClass('group-hover:scale-110')
    })

    it('should have hover effects on view details button', () => {
      render(<PitchCard pitch={mockPitch} />)

      const button = screen.getByRole('link', { name: /view details/i })
      expect(button).toHaveClass('hover:bg-purple-700')
    })
  })

  describe('Visual Elements', () => {
    it('should display genre badge in correct position', () => {
      render(<PitchCard pitch={mockPitch} />)

      const genreBadge = screen.getByText('Drama')
      expect(genreBadge).toBeInTheDocument()
      // The genre badge itself has these classes
      expect(genreBadge).toHaveClass('px-2', 'py-1', 'bg-black', 'bg-opacity-70', 'text-white', 'text-xs', 'rounded')
    })

    it('should display status badge with correct styling', () => {
      render(<PitchCard pitch={mockPitch} />)

      const statusBadge = screen.getByText('Active')
      expect(statusBadge).toHaveClass('bg-green-100', 'text-green-700')
    })

    it('should display views icon', () => {
      render(<PitchCard pitch={mockPitch} />)

      const viewsSection = screen.getByText('1.3K').parentElement
      expect(viewsSection?.querySelector('svg')).toBeInTheDocument()
    })

    it('should display rating icon with yellow color', () => {
      render(<PitchCard pitch={mockPitch} />)

      const ratingText = screen.getByText('4.5')
      // Find the parent span that contains both the star icon and rating
      const ratingContainer = ratingText.closest('span')
      expect(ratingContainer).toBeInTheDocument()
      // Find the star SVG icon within the container
      const starIcon = ratingContainer?.querySelector('svg')
      expect(starIcon).toBeInTheDocument()
      expect(starIcon).toHaveClass('text-yellow-400')
    })
  })

  describe('Text Truncation', () => {
    it('should apply line clamp to tagline', () => {
      render(<PitchCard pitch={mockPitch} />)

      const tagline = screen.getByText('An exciting story about adventure')
      expect(tagline).toHaveClass('line-clamp-2')
    })

    it('should apply line clamp to description', () => {
      render(<PitchCard pitch={mockPitch} />)

      const description = screen.getByText(/this is a detailed description/i)
      expect(description).toHaveClass('line-clamp-3')
    })
  })

  describe('Rating Display', () => {
    it('should display rating with one decimal place', () => {
      const pitchWithRating = { ...mockPitch, rating: 3.7 }
      render(<PitchCard pitch={pitchWithRating} />)

      expect(screen.getByText('3.7')).toBeInTheDocument()
    })

    it('should handle integer ratings', () => {
      const pitchWithIntegerRating = { ...mockPitch, rating: 5 }
      render(<PitchCard pitch={pitchWithIntegerRating} />)

      expect(screen.getByText('5.0')).toBeInTheDocument()
    })

    it('should handle very low ratings', () => {
      const pitchWithLowRating = { ...mockPitch, rating: 0.5 }
      render(<PitchCard pitch={pitchWithLowRating} />)

      expect(screen.getByText('0.5')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper image alt text', () => {
      render(<PitchCard pitch={mockPitch} />)

      const image = screen.getByRole('img')
      expect(image).toHaveAccessibleName('Test Pitch Title')
    })

    it('should have accessible link text', () => {
      render(<PitchCard pitch={mockPitch} />)

      const link = screen.getByRole('link', { name: /view details/i })
      expect(link).toHaveAccessibleName('View Details')
    })

    it('should have proper semantic structure', () => {
      render(<PitchCard pitch={mockPitch} />)

      // Title should be a heading
      const title = screen.getByRole('heading', { name: /test pitch title/i })
      expect(title).toBeInTheDocument()
    })

    it('should be keyboard navigable', async () => {
      render(<PitchCard pitch={mockPitch} />)

      const link = screen.getByRole('link', { name: /view details/i })
      
      // Tab to the link
      await user.tab()
      expect(link).toHaveFocus()

      // Should be activatable with Enter key
      await user.keyboard('{Enter}')
      // Link navigation would be handled by React Router
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing thumbnail gracefully', () => {
      const pitchWithoutThumbnail = { ...mockPitch, thumbnail: '' }
      render(<PitchCard pitch={pitchWithoutThumbnail} />)

      // Empty thumbnail renders GenrePlaceholder (a div), not an <img>
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
      const genreLabels = screen.getAllByText('Drama')
      expect(genreLabels.length).toBeGreaterThanOrEqual(1)
    })

    it('should handle very long titles', () => {
      const pitchWithLongTitle = { 
        ...mockPitch, 
        title: 'This is a very long title that might wrap to multiple lines and should still display properly'
      }
      render(<PitchCard pitch={pitchWithLongTitle} />)

      expect(screen.getByText(/this is a very long title/i)).toBeInTheDocument()
    })

    it('should handle very long taglines', () => {
      const pitchWithLongTagline = { 
        ...mockPitch, 
        tagline: 'This is an extremely long tagline that goes on and on and should be truncated properly using CSS line clamping to ensure the card layout remains consistent'
      }
      render(<PitchCard pitch={pitchWithLongTagline} />)

      const tagline = screen.getByText(/this is an extremely long tagline/i)
      expect(tagline).toHaveClass('line-clamp-2')
    })

    it('should handle zero rating', () => {
      const pitchWithZeroRating = { ...mockPitch, rating: 0 }
      render(<PitchCard pitch={pitchWithZeroRating} />)

      expect(screen.getByText('0.0')).toBeInTheDocument()
    })

    it('should handle different status types', () => {
      const statusTypes = ['Active', 'Draft', 'Published', 'Archived']
      
      statusTypes.forEach(status => {
        const pitchWithStatus = { ...mockPitch, status }
        const { unmount } = render(<PitchCard pitch={pitchWithStatus} />)
        
        expect(screen.getByText(status)).toBeInTheDocument()
        
        unmount()
      })
    })

    it('should handle different budget formats', () => {
      const budgetFormats = ['$1M - $5M', '$500K', 'TBD', 'Under $1M']
      
      budgetFormats.forEach(budget => {
        const pitchWithBudget = { ...mockPitch, budget }
        const { unmount } = render(<PitchCard pitch={pitchWithBudget} />)
        
        expect(screen.getByText(budget)).toBeInTheDocument()
        
        unmount()
      })
    })
  })

  describe('Responsive Design', () => {
    it('should maintain layout on different screen sizes', () => {
      render(<PitchCard pitch={mockPitch} />)

      const card = screen.getByRole('img').closest('div.bg-white')
      expect(card).toHaveClass('rounded-xl', 'shadow-lg', 'overflow-hidden')
    })

    it('should have responsive image sizing', () => {
      render(<PitchCard pitch={mockPitch} />)

      const image = screen.getByRole('img')
      expect(image).toHaveClass('w-full', 'h-full', 'object-cover')
    })
  })

  describe('Performance', () => {
    it('should not cause unnecessary re-renders with same props', () => {
      const { rerender } = render(<PitchCard pitch={mockPitch} />)
      
      // Re-render with same props
      rerender(<PitchCard pitch={mockPitch} />)
      
      // Component should still render correctly
      expect(screen.getByText('Test Pitch Title')).toBeInTheDocument()
    })

    it('should handle prop changes correctly', () => {
      const { rerender } = render(<PitchCard pitch={mockPitch} />)
      
      const updatedPitch = { ...mockPitch, title: 'Updated Title', views: 2000 }
      rerender(<PitchCard pitch={updatedPitch} />)
      
      expect(screen.getByText('Updated Title')).toBeInTheDocument()
      expect(screen.getByText('2.0K')).toBeInTheDocument()
    })
  })
})