Feature: Search
  Filter on Memories opens Search. Smart dates (`yesterday`, `last winter`,
  `a day in june`) plus year and favorites facets. Library clock is frozen
  at 26 August 2026.

  Scenario: Filter on memories opens search on every viewport
    Given today is 26 August 2026
    And I am signed in
    Then I should see the heading "Your memries"
    When I open the Filter on memories
    Then I should see the heading "Search"
    And I should see the search suggestions

  Scenario: Search shows date capabilities before typing
    Given today is 26 August 2026
    And I am signed in
    When I open the "Search" tab
    Then I should see the search suggestions
    And I should see 11 search results

  Scenario Outline: Typed smart date finds the matching memories
    Given today is 26 August 2026
    And I am signed in
    When I open the "Search" tab
    And I search for "<phrase>"
    Then the search should read "<reading>"
    And I should see <count> search results
    And I should see the photo from "<seen>" in search results
    And I should not see the photo from "<unseen>" in search results

    Examples:
      | phrase            | reading                                | count | seen                           | unseen                         |
      | yesterday         | Yesterday · 25 August 2026             | 1     | Tuesday, 25 August 2026        | Wednesday, 26 August 2026      |
      | last week         | Last week · 17–23 Aug 2026             | 1     | Wednesday, 19 August 2026      | Monday, 24 August 2026         |
      | last july         | Last July · July 2026                  | 1     | Wednesday, 15 July 2026        | Wednesday, 10 June 2026        |
      | a day in june     | June                                   | 1     | Wednesday, 10 June 2026        | Wednesday, 15 July 2026        |
      | june              | June                                   | 1     | Wednesday, 10 June 2026        | Wednesday, 15 July 2026        |
      | last winter       | Last winter · Dec 2025–Feb 2026        | 1     | Saturday, 20 December 2025     | Wednesday, 8 October 2025      |
      | previous spring   | Previous spring · Mar–May 2026         | 1     | Sunday, 12 April 2026          | Wednesday, 15 March 2023       |
      | previous fall     | Previous fall · Sep–Nov 2025           | 1     | Wednesday, 8 October 2025      | Saturday, 20 December 2025     |

  Scenario: In the summer includes this year's June through August
    Given today is 26 August 2026
    And I am signed in
    When I open the "Search" tab
    And I search for "in the summer"
    Then the search should read "Summer 2026 · Jun–Aug"
    And I should see 7 search results
    And I should see the photo from "Monday, 31 August 2026" in search results
    And I should see the photo from "Wednesday, 15 July 2026" in search results
    And I should see the photo from "Wednesday, 10 June 2026" in search results
    And I should see the photo from "Wednesday, 19 August 2026" in search results
    And I should not see the photo from "Sunday, 12 April 2026" in search results
    And I should not see the photo from "Saturday, 20 December 2025" in search results
    And I should not see the photo from "Wednesday, 8 October 2025" in search results

  Scenario Outline: Suggestion chips apply the same smart date as typing
    Given today is 26 August 2026
    And I am signed in
    When I open the "Search" tab
    And I choose the search suggestion "<chip>"
    Then the search should read "<reading>"
    And I should see <count> search results
    And I should see the photo from "<seen>" in search results

    Examples:
      | chip             | reading                                | count | seen                           |
      | Yesterday        | Yesterday · 25 August 2026             | 1     | Tuesday, 25 August 2026        |
      | Last week        | Last week · 17–23 Aug 2026             | 1     | Wednesday, 19 August 2026      |
      | Last July        | Last July · July 2026                  | 1     | Wednesday, 15 July 2026        |
      | Last winter      | Last winter · Dec 2025–Feb 2026        | 1     | Saturday, 20 December 2025     |
      | In the summer    | Summer 2026 · Jun–Aug                  | 7     | Wednesday, 10 June 2026        |
      | June             | June                                   | 1     | Wednesday, 10 June 2026        |
      | Previous spring  | Previous spring · Mar–May 2026         | 1     | Sunday, 12 April 2026          |
      | Previous fall    | Previous fall · Sep–Nov 2025           | 1     | Wednesday, 8 October 2025      |

  Scenario: Filter from memories then a smart date
    Given today is 26 August 2026
    And I am signed in
    When I open the Filter on memories
    And I search for "yesterday"
    Then the search should read "Yesterday · 25 August 2026"
    And I should see 1 search results
    And I should see the photo from "Tuesday, 25 August 2026" in search results

  Scenario: Typed year still works as a smart date
    Given today is 26 August 2026
    And I am signed in
    When I open the "Search" tab
    And I search for "2025"
    Then I should see 2 search results
    And I should see the photo from "Saturday, 20 December 2025" in search results
    And I should see the photo from "Wednesday, 8 October 2025" in search results
    And I should not see the photo from "Monday, 31 August 2026" in search results

  Scenario: Year facet and favorites filter
    Given today is 26 August 2026
    And I am signed in
    When I open the photo from "Saturday, 20 December 2025"
    And I add the viewer photo to favorites
    And I close the photo viewer
    And I search for year "2025"
    Then I should see 2 search results
    When I filter search to favorites
    Then I should see 1 search results
    And I should see the photo from "Saturday, 20 December 2025" in search results
    And I should not see the photo from "Wednesday, 8 October 2025" in search results

  Scenario: Smart date combined with favorites
    Given today is 26 August 2026
    And I am signed in
    When I open the photo from "Wednesday, 15 July 2026"
    And I add the viewer photo to favorites
    And I close the photo viewer
    And I open the "Search" tab
    And I search for "last july"
    Then I should see 1 search results
    When I filter search to favorites
    Then I should see 1 search results
    And I should see the photo from "Wednesday, 15 July 2026" in search results
    When I search for "yesterday"
    Then I should see no matching search results

  Scenario: Year facet combined with a smart date
    Given today is 26 August 2026
    And I am signed in
    When I open the "Search" tab
    And I search for "last winter"
    And I search for year "2026"
    Then I should see no matching search results
    When I search for year "2025"
    Then I should see 1 search results
    And I should see the photo from "Saturday, 20 December 2025" in search results

  Scenario: Unknown phrase shows no matches and keeps capabilities visible
    Given today is 26 August 2026
    And I am signed in
    When I open the "Search" tab
    And I search for "next christmas"
    Then I should see no matching search results
    And I should see the search suggestions

  Scenario: Clearing a smart date restores the library
    Given today is 26 August 2026
    And I am signed in
    When I open the "Search" tab
    And I search for "yesterday"
    Then I should see 1 search results
    When I search for ""
    Then I should see 11 search results
    And I should see the search suggestions

  Scenario: Suggestion chips are offered on Search
    Given today is 26 August 2026
    And I am signed in
    When I open the "Search" tab
    Then I should see the search suggestions
    And the search suggestion chips should be ready

  Scenario: Year facet chips toggle
    Given today is 26 August 2026
    And I am signed in
    When I open the "Search" tab
    And I search for year "2025"
    Then the year facet "2025" is selected
    When I search for year "2025"
    Then the year facet "2025" is not selected
    And I should see 11 search results

  Scenario: Search thumbs stay compact and originals wait for the viewer
    Given I am watching media requests
    And today is 26 August 2026
    And I am signed in
    When I open the "Search" tab
    Then compact thumbnails should use the size for this viewport
    And no original image has been requested
    When I open the photo from "Monday, 31 August 2026"
    Then the original image is requested
